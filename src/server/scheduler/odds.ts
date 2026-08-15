import type { Server } from "socket.io";
import { prisma } from "@/lib/db";
import * as oddsApi from "@/server/adapters/odds-api";
import { fallbackOdds, liveFallbackOdds } from "@/lib/betting/fallback-odds";

/**
 * Upsert a set of markets ({key → selectionKey → value}) for one fixture,
 * preserving previousValue and broadcasting odds:update for changed rows.
 * Returns the number of odds written.
 */
export async function upsertMarketSelections(
  fixtureId: string,
  markets: ReadonlyArray<readonly [string, Record<string, number>]>,
  io?: Server,
): Promise<number> {
  let written = 0;

  for (const [marketKey, selections] of markets) {
    const market = await prisma.market.upsert({
      where: { fixtureId_key: { fixtureId, key: marketKey } },
      create: { fixtureId, key: marketKey, status: "OPEN" },
      update: { status: "OPEN" },
    });

    for (const [selectionKey, value] of Object.entries(selections)) {
      const existing = await prisma.odds.findUnique({
        where: { marketId_selectionKey: { marketId: market.id, selectionKey } },
      });

      if (existing) {
        if (Math.abs(existing.value.toNumber() - value) < 0.005) continue;
        await prisma.odds.update({
          where: { id: existing.id },
          data: { value, previousValue: existing.value, updatedAt: new Date() },
        });
      } else {
        await prisma.odds.create({
          data: { marketId: market.id, selectionKey, value },
        });
      }

      written++;
      const payload = {
        fixtureId,
        marketKey,
        selectionKey,
        value,
        previousValue: existing?.value.toNumber() ?? null,
      };
      io?.to(`live:fixture:${fixtureId}`).emit("odds:update", payload);
      io?.to("live").emit("odds:update", payload);
    }
  }

  return written;
}

const STOP_WORDS = new Set([
  "fc", "cf", "sc", "afc", "fk", "bk", "ac", "as", "ss", "cd", "club", "de", "the",
]);

export function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .join("");
}

function nameSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 6 && b.includes(a)) return true;
  if (b.length >= 6 && a.includes(b)) return true;
  return false;
}

interface FixtureLike {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: Date;
}

export async function upsertOddsForFixtures(
  normalized: oddsApi.NormalizedOdds[],
  fixtures: FixtureLike[],
  io?: Server,
): Promise<number> {
  let emitted = 0;

  for (const ev of normalized) {
    const kick = ev.commenceTime.getTime();
    const home = normalizeTeam(ev.homeTeam);
    const away = normalizeTeam(ev.awayTeam);

    const match = fixtures.find((f) => {
      const delta = Math.abs(f.kickoff.getTime() - kick);
      if (delta > 3 * 3600 * 1000) return false;
      return nameSimilar(normalizeTeam(f.homeTeam), home) && nameSimilar(normalizeTeam(f.awayTeam), away);
    });
    if (!match) continue;

    for (const [marketKey, selections] of Object.entries(ev.markets)) {
      if (!selections) continue;
      emitted += await upsertMarketSelections(match.id, [[marketKey, selections]], io);
    }
  }
  return emitted;
}

/** Refresh odds for pre-match fixtures (30m cadence). */
export async function refreshPreMatchOdds(io?: Server): Promise<void> {
  if (!oddsApi.isConfigured()) return;
  const events = await oddsApi.getOddsForSports();
  const fixtures = await prisma.fixture.findMany({
    where: {
      status: "SCHEDULED",
      kickoff: { gte: new Date(Date.now() - 3600 * 1000), lte: new Date(Date.now() + 36 * 3600 * 1000) },
    },
    select: { id: true, homeTeam: true, awayTeam: true, kickoff: true },
  });
  await upsertOddsForFixtures(events, fixtures, io);
}

/** Refresh odds for live fixtures (90s cadence). */
export async function refreshInPlayOdds(io?: Server): Promise<void> {
  if (!oddsApi.isConfigured()) return;
  const events = await oddsApi.getInPlayOdds();
  if (events.length === 0) return;
  const fixtures = await prisma.fixture.findMany({
    where: { status: "LIVE" },
    select: { id: true, homeTeam: true, awayTeam: true, kickoff: true },
  });
  await upsertOddsForFixtures(events, fixtures, io);
}

/**
 * Attach real pre-match odds from The Odds API to existing fixtures
 * (API-Football owns fixtures now). 1 call per sport per cycle.
 */
export async function refreshRealOdds(io?: Server): Promise<void> {
  if (!oddsApi.isConfigured()) return;

  for (const sportKey of oddsApi.SPORT_KEYS) {
    let events: oddsApi.NormalizedOdds[];
    try {
      events = await oddsApi.getOddsForSports([sportKey]);
    } catch {
      continue;
    }
    if (events.length === 0) continue;

    const fixtures = await prisma.fixture.findMany({
      where: {
        kickoff: {
          gte: new Date(Date.now() - 2 * 3600 * 1000),
          lte: new Date(Date.now() + 8 * 24 * 3600 * 1000),
        },
      },
      select: { id: true, homeTeam: true, awayTeam: true, kickoff: true },
    });

    await upsertOddsForFixtures(events, fixtures, io);
  }
}

/**
 * Deterministic fixed odds for scheduled fixtures that have no real odds
 * (The Odds API covers only the top leagues). Runs at boot and on the
 * interval; only touches fixtures with no h2h market, so real odds rows
 * are never overwritten. Deterministic generator => stable across runs.
 */
export async function backfillFallbackOdds(io?: Server): Promise<number> {
  const fixtures = await prisma.fixture.findMany({
    where: {
      status: "SCHEDULED",
      markets: { none: { key: "h2h" } },
    },
    select: { id: true, homeTeam: true, awayTeam: true },
  });
  if (fixtures.length === 0) return 0;

  const markets: Array<[string, Record<string, number>]> = [
    ["h2h", {} as Record<string, number>],
    ["totals", {} as Record<string, number>],
    ["btts", {} as Record<string, number>],
  ];
  let written = 0;

  for (const f of fixtures) {
    const odds = fallbackOdds(f);
    markets[0][1] = odds.h2h;
    markets[1][1] = odds.totals;
    markets[2][1] = odds.btts;

    written += await upsertMarketSelections(f.id, markets, io);
  }
  console.log(`[odds:fallback] ${written} selections written for ${fixtures.length} fixtures`);
  return written;
}

/**
 * In-play odds for LIVE fixtures, regenerated from the deterministic live
 * model (score + minute aware). Runs on score/minute changes and on a short
 * interval so live markets always move. Real pre-match odds rows are
 * overwritten on purpose: frozen odds on a live match are worse than any
 * movement.
 */
export async function refreshLiveFallbackOdds(io?: Server): Promise<number> {
  const fixtures = await prisma.fixture.findMany({
    where: { status: "LIVE" },
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      homeScore: true,
      awayScore: true,
      minute: true,
    },
  });
  if (fixtures.length === 0) return 0;

  const markets: Array<[string, Record<string, number>]> = [
    ["h2h", {} as Record<string, number>],
    ["totals", {} as Record<string, number>],
    ["btts", {} as Record<string, number>],
  ];
  let written = 0;

  for (const f of fixtures) {
    const odds = liveFallbackOdds(f, {
      homeScore: f.homeScore ?? 0,
      awayScore: f.awayScore ?? 0,
      minute: f.minute ?? 0,
    });
    markets[0][1] = odds.h2h;
    markets[1][1] = odds.totals;
    markets[2][1] = odds.btts;

    written += await upsertMarketSelections(f.id, markets, io);
  }
  if (written > 0) {
    console.log(`[odds:live] ${written} selections updated for ${fixtures.length} live fixtures`);
  }
  return written;
}
