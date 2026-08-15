import type { Server } from "socket.io";
import { prisma } from "@/lib/db";
import * as footballData from "@/server/adapters/football-data";
import { normalizeTeam } from "@/server/scheduler/odds";
import { leaguePriority, isProfessionalLeague } from "@/lib/leagues";

/**
 * Full-week fixture sync via football-data.org (no free-tier date cap,
 * all competitions, real crests). API-Football remains the source for
 * today's matches (live events + lineups) — this skips any fixture whose
 * teams + kickoff already exist in the DB.
 */
export async function refreshWeekFixtures(_io?: Server): Promise<void> {
  if (!footballData.isConfigured()) return;

  const dateFrom = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const dateTo = new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const fixtures = await footballData.getMatchesRange(dateFrom, dateTo);
  if (fixtures.length === 0) return;

  // Existing fixtures to dedupe against (today's matches are API-Football-owned)
  const existing = await prisma.fixture.findMany({
    where: { kickoff: { gte: new Date(Date.now() - 36 * 3600 * 1000) } },
    select: { id: true, homeTeam: true, awayTeam: true, kickoff: true },
  });

  let created = 0;
  let skipped = 0;
  for (const f of fixtures) {
    if (!isProfessionalLeague(f.competition.name)) continue;
    // League must be upserted even when the fixture is a dup — otherwise
    // priority never lands on leagues whose fixtures already exist.
    const league = await prisma.league.upsert({
      where: { providerId: f.competition.providerId },
      create: {
        providerId: f.competition.providerId,
        name: f.competition.name,
        country: "",
        logo: f.competition.emblem,
        season: new Date().getFullYear(),
        priority: leaguePriority(f.competition.providerId),
      },
      update: {
        name: f.competition.name,
        logo: f.competition.emblem,
        priority: leaguePriority(f.competition.providerId),
      },
    });

    const kick = f.kickoff.getTime();
    const home = normalizeTeam(f.homeTeam);
    const away = normalizeTeam(f.awayTeam);
    const dup = existing.some(
      (e) =>
        Math.abs(e.kickoff.getTime() - kick) < 20 * 60 * 1000 &&
        normalizeTeam(e.homeTeam) === home &&
        normalizeTeam(e.awayTeam) === away,
    );
    if (dup) {
      skipped++;
      continue;
    }

    await prisma.fixture.upsert({
      where: { providerId: f.providerId },
      create: {
        providerId: f.providerId,
        leagueId: league.id,
        kickoff: f.kickoff,
        status: f.status,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        homeLogo: f.homeCrest,
        awayLogo: f.awayCrest,
        homeScore: f.homeScore ?? 0,
        awayScore: f.awayScore ?? 0,
      },
      update: {
        status: f.status,
        homeScore: f.homeScore ?? undefined,
        awayScore: f.awayScore ?? undefined,
      },
    });
    created++;
  }
  console.log(`[week] ${dateFrom} → ${dateTo}: ${created} created, ${skipped} skipped (dup)`);
}
