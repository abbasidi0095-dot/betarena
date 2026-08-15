import type { Server } from "socket.io";
import { prisma } from "@/lib/db";
import * as apiFootball from "@/server/adapters/api-football";
import { leaguePriority } from "@/lib/leagues";

/** Today's matches (live events + lineups source) — API-Football free tier
 * caps lookups at ~3 days anyway; the full week comes from football-data. */
export async function refreshFixtures(_io?: Server): Promise<void> {
  if (!apiFootball.isConfigured()) return;
  for (let d = -1; d <= 1; d++) {
    const date = new Date(Date.now() + d * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const fixtures = await apiFootball.getFixturesByDate(date);
    for (const f of fixtures) {
      const league = await prisma.league.upsert({
        where: { providerId: f.league.providerId },
        create: {
          providerId: f.league.providerId,
          name: f.league.name,
          country: f.league.country,
          logo: f.league.logo,
          season: f.league.season,
          priority: leaguePriority(f.league.providerId),
        },
        update: {
          name: f.league.name,
          logo: f.league.logo,
          country: f.league.country,
          priority: leaguePriority(f.league.providerId),
        },
      });

      const existing = await prisma.fixture.findUnique({
        where: { providerId: f.providerId },
      });

      await prisma.fixture.upsert({
        where: { providerId: f.providerId },
        create: {
          providerId: f.providerId,
          leagueId: league.id,
          kickoff: f.kickoff,
          status: f.status,
          homeTeam: f.homeTeam,
          awayTeam: f.awayTeam,
          homeLogo: f.homeLogo,
          awayLogo: f.awayLogo,
          homeScore: f.homeScore,
          awayScore: f.awayScore,
          minute: f.minute,
          events: f.events as any,
        },
        update: {
          status: f.status,
          homeTeam: f.homeTeam,
          awayTeam: f.awayTeam,
          homeLogo: f.homeLogo ?? undefined,
          awayLogo: f.awayLogo ?? undefined,
          homeScore: f.homeScore,
          awayScore: f.awayScore,
          minute: f.minute,
          events: f.events as any,
        },
      });

      // Mark finished matches' markets closed
      if (f.status === "FINISHED" && existing?.status !== "FINISHED") {
        await prisma.market.updateMany({
          where: { fixtureId: existing?.id ?? "", status: "OPEN" },
          data: { status: "CLOSED" },
        });
      }
    }
    console.log(`[fixtures] ${date}: ${fixtures.length} matches`);
  }
}

/** League standings for tracked competitions (1 request per league). */
export async function refreshStandings(_io?: Server): Promise<void> {
  if (!apiFootball.isConfigured()) return;
  const season = new Date().getFullYear();
  for (const [sportKey, leagueApiId] of Object.entries(apiFootball.LEAGUE_IDS)) {
    try {
      const standings = await apiFootball.getStandings(leagueApiId, season);
      const league = await prisma.league.findUnique({
        where: { providerId: sportKey },
      });
      if (!league) {
        // League not synced yet — create a stub so standings show
        const meta =
          sportKey === "soccer_epl"
            ? { name: "Premier League", country: "England" }
            : sportKey === "soccer_spain_la_liga"
              ? { name: "La Liga", country: "Spain" }
              : sportKey === "soccer_italy_serie_a"
                ? { name: "Serie A", country: "Italy" }
                : sportKey === "soccer_germany_bundesliga"
                  ? { name: "Bundesliga", country: "Germany" }
                  : sportKey === "soccer_france_ligue_one"
                    ? { name: "Ligue 1", country: "France" }
                    : { name: sportKey, country: "" };
        const created = await prisma.league.create({
          data: {
            providerId: sportKey,
            name: meta.name,
            country: meta.country,
            season,
            priority: leaguePriority(sportKey),
            standings: standings as any,
          },
        });
        void created;
        continue;
      }
      await prisma.league.update({
        where: { id: league.id },
        data: { standings: standings as any },
      });
    } catch (err: any) {
      console.error(`[standings:${sportKey}]`, err?.message ?? err);
    }
  }
}

/** Real lineups for fixtures starting within the next 24h (1 request per fixture). */
export async function refreshLineups(_io?: Server): Promise<void> {
  if (!apiFootball.isConfigured()) return;
  const fixtures = await prisma.fixture.findMany({
    where: {
      providerId: { not: { startsWith: "fd:" } },
      kickoff: { gte: new Date(Date.now() - 2 * 3600 * 1000), lte: new Date(Date.now() + 26 * 3600 * 1000) },
      lineups: { equals: [] as any },
    },
    select: { providerId: true, homeTeam: true, awayTeam: true },
    take: 12,
  });
  if (fixtures.length === 0) return;

  const lineups = await apiFootball.getLineups(fixtures.map((f) => f.providerId));
  for (const fixture of fixtures) {
    const rows = lineups.filter((l) => l.fixtureProviderId === fixture.providerId);
    if (rows.length < 2) continue;
    const normalized = rows.map((r) => ({
      team: r.teamName === fixture.homeTeam ? "home" : r.teamName === fixture.awayTeam ? "away" : "unknown",
      teamName: r.teamName,
      formation: r.formation,
      players: r.players,
    }));
    if (normalized.some((n) => n.team === "unknown")) continue;
    await prisma.fixture.update({
      where: { providerId: fixture.providerId },
      data: { lineups: normalized as any },
    });
  }
}
