import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { unauthorized, unprocessable } from "@/lib/api";

const DAY = 24 * 3600 * 1000;
const BONUS = 100;

export async function POST() {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return unauthorized();

  if (user.lastDailyBonusAt && Date.now() - user.lastDailyBonusAt.getTime() < DAY) {
    return unprocessable("Daily bonus already claimed — come back tomorrow");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { pointBalance: { increment: BONUS }, lastDailyBonusAt: new Date() },
  });

  return NextResponse.json({ pointBalance: updated.pointBalance, claimed: BONUS });
}
