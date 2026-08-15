import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rankBettors } from "@/lib/community/rank";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tab = params.get("tab") ?? "feed";

  if (tab === "top") {
    const period = params.get("period") ?? "week";
    const since =
      period === "today" ? new Date(new Date().setHours(0, 0, 0, 0)) : new Date(Date.now() - 7 * 86_400_000);
    const bets = await prisma.bet.findMany({
      where: { status: { in: ["WON", "LOST"] }, placedAt: { gte: since } },
      select: { userId: true, user: { select: { username: true, isBot: true } }, status: true },
    });
    const rows = bets.map((b) => ({
      userId: b.userId,
      username: b.user.username,
      isBot: b.user.isBot,
      won: b.status === "WON",
    }));
    return NextResponse.json({ top: rankBettors(rows) });
  }

  // tab=feed
  const fixtureId = params.get("fixtureId");
  const bets = await prisma.bet.findMany({
    where: fixtureId ? { legs: { some: { fixtureId } } } : {},
    orderBy: { placedAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      stakeTotal: true,
      potentialReturn: true,
      payout: true,
      status: true,
      placedAt: true,
      user: { select: { username: true, isBot: true } },
      legs: {
        select: {
          fixtureId: true,
          marketKey: true,
          selectionKey: true,
          selectionName: true,
          oddsLocked: true,
          fixture: { select: { homeTeam: true, awayTeam: true, kickoff: true } },
        },
      },
    },
  });
  return NextResponse.json({
    bets: bets.map((b) => ({
      id: b.id,
      type: b.type,
      stakeTotal: b.stakeTotal,
      potentialReturn: Number(b.potentialReturn),
      payout: b.payout,
      status: b.status,
      placedAt: b.placedAt,
      username: b.user.username,
      isBot: b.user.isBot,
      legs: b.legs.map((l) => ({
        fixtureId: l.fixtureId,
        marketKey: l.marketKey,
        selectionKey: l.selectionKey,
        selectionName: l.selectionName,
        odds: Number(l.oddsLocked),
        label: `${l.fixture.homeTeam} vs ${l.fixture.awayTeam}`,
      })),
    })),
  });
}
