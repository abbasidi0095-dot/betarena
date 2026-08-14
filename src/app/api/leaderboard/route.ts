import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  const scope = req.nextUrl.searchParams.get("scope") ?? "global";

  if (scope === "friends") {
    if (!session) return unauthorized();
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: session.id }, { addresseeId: session.id }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const friendIds = friendships.map((f) =>
      f.requesterId === session.id ? f.addresseeId : f.requesterId,
    );
    friendIds.push(session.id);

    const users = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      orderBy: { totalWon: "desc" },
      take: 50,
    });
    return NextResponse.json({ leaderboard: users.map(formatRow) });
  }

  const users = await prisma.user.findMany({
    orderBy: { totalWon: "desc" },
    take: 50,
  });
  return NextResponse.json({ leaderboard: users.map(formatRow) });
}

function formatRow(u: {
  id: string;
  username: string;
  pointBalance: number;
  totalWon: number;
  totalStaked: number;
  betsWon: number;
  betsLost: number;
  isBot: boolean;
}) {
  const decided = u.betsWon + u.betsLost;
  return {
    id: u.id,
    username: u.username,
    pointBalance: u.pointBalance,
    totalWon: u.totalWon,
    totalStaked: u.totalStaked,
    betsWon: u.betsWon,
    betsLost: u.betsLost,
    winPct: decided > 0 ? Math.round((u.betsWon / decided) * 100) : 0,
    roi: u.totalStaked > 0 ? Math.round(((u.totalWon - u.totalStaked) / u.totalStaked) * 100) : 0,
    isBot: u.isBot,
  };
}
