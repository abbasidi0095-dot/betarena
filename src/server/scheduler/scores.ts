import type { Server } from "socket.io";
import { prisma } from "@/lib/db";
import * as apiFootball from "@/server/adapters/api-football";

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
