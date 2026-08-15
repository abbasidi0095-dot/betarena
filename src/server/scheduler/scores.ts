import type { Server } from "socket.io";
import { prisma } from "@/lib/db";
import * as apiFootball from "@/server/adapters/api-football";
import * as footballData from "@/server/adapters/football-data";
import { normalizeTeam } from "@/server/scheduler/odds";

/** Poll live fixtures; emit score:update on any change. */
export async function refreshLiveScores(io?: Server): Promise<void> {
  if (!apiFootball.isConfigured() || !io) return;

  const liveCount = await prisma.fixture.count({ where: { status: "LIVE" } });
  if (liveCount === 0) return;

  const fixtures = await apiFootball.getLiveFixtures();
  for (const f of fixtures) {
    const existing = await prisma.fixture.findUnique({
      where: { providerId: f.providerId },
    });
    if (!existing) continue;

    const changed =
      existing.homeScore !== f.homeScore ||
      existing.awayScore !== f.awayScore ||
      existing.minute !== f.minute ||
      JSON.stringify(existing.events) !== JSON.stringify(f.events);

    await prisma.fixture.update({
      where: { id: existing.id },
      data: {
        status: f.status,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        minute: f.minute,
        events: f.events as any,
      },
    });

    if (changed) {
      const payload = {
        fixtureId: existing.id,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        minute: f.minute,
        events: f.events,
      };
      io.to(`live:fixture:${existing.id}`).emit("score:update", payload);
      io.to("live").emit("score:update", payload);
    }
  }
}

/**
 * Minute refresh via football-data.org (4 free keys, 10 req/min each):
 * polls live + finished matches every 60s and pushes real-time minute/score.
 */
export async function refreshLiveMinutes(io?: Server): Promise<void> {
  if (!footballData.isConfigured()) return;

  const matches = await footballData.getLiveMatches();
  if (matches.length === 0) return;

  // Candidate window: kickoff within the last 24h (covers in-play + recent FT)
  const minKick = Date.now() - 24 * 3600 * 1000;
  const candidates = matches.filter((m) => m.kickoff.getTime() >= minKick);
  if (candidates.length === 0) return;

  const fixtures = await prisma.fixture.findMany({
    where: { status: { in: ["SCHEDULED", "LIVE"] } },
    select: { id: true, providerId: true, homeTeam: true, awayTeam: true, kickoff: true, status: true, homeLogo: true, awayLogo: true },
  });

  for (const m of candidates) {
    const home = normalizeTeam(m.homeTeam);
    const away = normalizeTeam(m.awayTeam);
    const kick = m.kickoff.getTime();

    const match = fixtures.find((f) => {
      const delta = Math.abs(f.kickoff.getTime() - kick);
      if (delta > 3 * 3600 * 1000) return false;
      return (
        normalizeTeam(f.homeTeam) === home && normalizeTeam(f.awayTeam) === away
      );
    });
    if (!match) continue;

    const changed =
      match.homeLogo !== m.homeCrest ||
      match.awayLogo !== m.awayCrest ||
      match.status !== m.status ||
      m.homeScore !== null || m.awayScore !== null;

    await prisma.fixture.update({
      where: { id: match.id },
      data: {
        status: m.status,
        minute: m.minute ?? undefined,
        homeScore: m.homeScore ?? undefined,
        awayScore: m.awayScore ?? undefined,
        homeLogo: match.homeLogo ?? m.homeCrest ?? undefined,
        awayLogo: match.awayLogo ?? m.awayCrest ?? undefined,
      },
    });

    if (changed && io) {
      const payload = {
        fixtureId: match.id,
        homeScore: m.homeScore ?? 0,
        awayScore: m.awayScore ?? 0,
        minute: m.minute,
        events: [],
      };
      io.to(`live:fixture:${match.id}`).emit("score:update", payload);
      io.to("live").emit("score:update", payload);
    }
  }
}
