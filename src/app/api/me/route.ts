import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";


const DAY = 24 * 3600 * 1000;

export async function GET() {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return unauthorized();
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      pointBalance: user.pointBalance,
      canClaimDailyBonus:
        !user.lastDailyBonusAt || Date.now() - user.lastDailyBonusAt.getTime() >= DAY,
      canRescue:
        user.pointBalance === 0 &&
        (!user.lastRescueAt || Date.now() - user.lastRescueAt.getTime() >= DAY),
      stats: {
        totalWon: user.totalWon,
        totalStaked: user.totalStaked,
        betsWon: user.betsWon,
        betsLost: user.betsLost,
      },
    },
  });
}
