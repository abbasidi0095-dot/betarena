import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { unauthorized, unprocessable, badRequest } from "@/lib/api";
import { friendRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = friendRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const target = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });
  if (!target || target.isBot === false && target.id === session.id) {
    return unprocessable("User not found");
  }
  if (target.id === session.id) return unprocessable("You cannot friend yourself");

  const existing = await prisma.friendship.findUnique({
    where: {
      requesterId_addresseeId: { requesterId: session.id, addresseeId: target.id },
    },
  });
  const existingReverse = await prisma.friendship.findUnique({
    where: {
      requesterId_addresseeId: { requesterId: target.id, addresseeId: session.id },
    },
  });
  if (existing || existingReverse) {
    return unprocessable("Friend request already exists or you are already friends");
  }

  await prisma.friendship.create({
    data: {
      requesterId: session.id,
      addresseeId: target.id,
      status: target.isBot ? "ACCEPTED" : "PENDING",
    },
  });

  return NextResponse.json({ ok: true, autoAccepted: target.isBot });
}
