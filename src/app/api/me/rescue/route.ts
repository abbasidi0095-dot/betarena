import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { unauthorized, unprocessable } from "@/lib/api";

const DAY = 24 * 3600 * 1000;
const RESCUE = 500;

export async function POST() {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return unauthorized();

  if (user.pointBalance > 0) {
    return unprocessable("Rescue top-up only available at zero balance");
  }
  if (user.lastRescueAt && Date.now() - user.lastRescueAt.getTime() < DAY) {
    return unprocessable("Rescue already used in the last 24 hours");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { pointBalance: { increment: RESCUE }, lastRescueAt: new Date() },
  });

  return NextResponse.json({ pointBalance: updated.pointBalance, claimed: RESCUE });
}
