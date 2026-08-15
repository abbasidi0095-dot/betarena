import type { Server } from "socket.io";
import { prisma } from "@/lib/db";
import * as oddsApi from "@/server/adapters/odds-api";

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
      const market = await prisma.market.upsert({
        where: { fixtureId_key: { fixtureId: match.id, key: marketKey } },
        create: { fixtureId: match.id, key: marketKey, status: "OPEN" },
        update: { status: "OPEN" },
      });

      for (const [selectionKey, value] of Object.entries(selections)) {
        const existing = await prisma.odds.findUnique({
          where: {
            marketId_selectionKey: { marketId: market.id, selectionKey },
          },
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

        emitted++;
        const payload = {
          fixtureId: match.id,
          marketKey,
          selectionKey,
          value,
          previousValue: existing?.value.toNumber() ?? null,
        };
        io?.to(`live:fixture:${match.id}`).emit("odds:update", payload);
        io?.to("live").emit("odds:update", payload);
      }
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
