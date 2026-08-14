import type { Server } from "socket.io";
import { prisma } from "@/lib/db";
import * as apiFootball from "@/server/adapters/api-football";

/** Refresh fixtures (and their leagues) for today ±2 days from API-Football. */
export async function refreshFixtures(_io?: Server): Promise<void> {
  if (!apiFootball.isConfigured()) return;
  const today = new Date();
  const dates = [-1, 0, 1, 2].map((d) => {
    const dt = new Date(today.getTime() + d * 24 * 3600 * 1000);
    return dt.toISOString().slice(0, 10);
  });

  for (const date of dates) {
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
        },
        update: { name: f.league.name, logo: f.league.logo },
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
          homeScore: f.homeScore,
          awayScore: f.awayScore,
          minute: f.minute,
          events: f.events as any,
        },
        update: {
          status: f.status,
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
  }
}
