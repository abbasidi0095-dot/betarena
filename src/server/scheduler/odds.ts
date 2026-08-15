import type { Server } from "socket.io";
import { prisma } from "@/lib/db";
import * as oddsApi from "@/server/adapters/odds-api";

const STOP_WORDS = new Set([
  "fc", "cf", "sc", "afc", "fk", "bk", "ac", "as", "ss", "cd", "club", "de", "the",
]);

function normalizeTeam(name: string): string {
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
 * Primary real-data path (no API-Football key needed): fetch The Odds API
 * events, create/refresh real leagues + fixtures from them, and attach real
 * pre-match odds. Quota-budgeted: 1 call per sport per cycle.
 */
export async function refreshOddsFixturesAndScores(io?: Server): Promise<void> {
  if (!oddsApi.isConfigured()) return;
  const now = Date.now();
  const farFuture = new Date(now + 7 * 24 * 3600 * 1000);

  for (const sportKey of oddsApi.SPORT_KEYS) {
    let events: oddsApi.NormalizedOdds[];
    try {
      events = await oddsApi.getOddsForSports([sportKey]);
    } catch {
      continue;
    }
    if (events.length === 0) continue;

    const meta = oddsApi.SPORT_META[sportKey] ?? { name: sportKey, country: "" };
    const league = await prisma.league.upsert({
      where: { providerId: `odds:${sportKey}` },
      create: {
        providerId: `odds:${sportKey}`,
        name: meta.name,
        country: meta.country,
        season: new Date().getFullYear(),
      },
      update: { name: meta.name, country: meta.country },
    });

    // Create/refresh fixtures from events (skip stale ones, cap window)
    const fixtureMap = new Map<string, { id: string; homeTeam: string; awayTeam: string; kickoff: Date }>();
    for (const ev of events) {
      const kick = ev.commenceTime.getTime();
      if (kick > farFuture.getTime() || kick < now - 2 * 3600 * 1000) continue;
      const providerId = `odds:${ev.homeTeam}|${ev.awayTeam}|${Math.round(kick / 60000)}`;
      const fixture = await prisma.fixture.upsert({
        where: { providerId },
        create: {
          providerId,
          leagueId: league.id,
          kickoff: ev.commenceTime,
          status: "SCHEDULED",
          homeTeam: ev.homeTeam,
          awayTeam: ev.awayTeam,
        },
        update: { kickoff: ev.commenceTime },
      });
      fixtureMap.set(providerId, {
        id: fixture.id,
        homeTeam: ev.homeTeam,
        awayTeam: ev.awayTeam,
        kickoff: ev.commenceTime,
      });
    }

    // Attach the real odds (match by exact teams + kickoff window)
    await upsertOddsForFixtures(
      events,
      [...fixtureMap.values()],
      io,
    );
  }

  // Scores pass for settlement — only COMPLETED events carry final scores;
  // the endpoint also lists upcoming matches, so never infer LIVE from it.
  try {
    const scores = await oddsApi.getScoresForSports(1);
    for (const s of scores) {
      if (!s.completed || s.homeScore === null || s.awayScore === null) continue;
      const providerId = `odds:${s.homeTeam}|${s.awayTeam}|${Math.round(s.commenceTime.getTime() / 60000)}`;
      const fixture = await prisma.fixture.findUnique({ where: { providerId } });
      if (!fixture || fixture.status === "FINISHED") continue;
      await prisma.fixture.update({
        where: { id: fixture.id },
        data: { status: "FINISHED", homeScore: s.homeScore, awayScore: s.awayScore, minute: 90 },
      });
      io?.to(`live:fixture:${fixture.id}`).emit("score:update", {
        fixtureId: fixture.id,
        homeScore: s.homeScore,
        awayScore: s.awayScore,
        minute: 90,
        events: [],
      });
    }
  } catch {
    // scores are best-effort; odds+fixtures already landed
  }
}
