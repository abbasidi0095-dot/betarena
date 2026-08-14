import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  const [friends, incoming, outgoing] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: session.id }, { addresseeId: session.id }],
      },
      include: {
        requester: { select: { id: true, username: true, pointBalance: true, totalWon: true } },
        addressee: { select: { id: true, username: true, pointBalance: true, totalWon: true } },
      },
    }),
    prisma.friendship.findMany({
      where: { addresseeId: session.id, status: "PENDING" },
      include: { requester: { select: { id: true, username: true } } },
    }),
    prisma.friendship.findMany({
      where: { requesterId: session.id, status: "PENDING" },
      include: { addressee: { select: { id: true, username: true } } },
    }),
  ]);

  const friendOf = (f: (typeof friends)[number]) =>
    f.requesterId === session.id ? f.addressee : f.requester;

  return NextResponse.json({
    friends: friends.map((f) => {
      const u = friendOf(f);
      return {
        friendshipKey: `${f.requesterId}:${f.addresseeId}`,
        id: u.id,
        username: u.username,
        pointBalance: u.pointBalance,
        totalWon: u.totalWon,
      };
    }),
    incoming: incoming.map((f) => ({
      friendshipKey: `${f.requesterId}:${f.addresseeId}`,
      id: f.requester.id,
      username: f.requester.username,
    })),
    outgoing: outgoing.map((f) => ({
      friendshipKey: `${f.requesterId}:${f.addresseeId}`,
      id: f.addressee.id,
      username: f.addressee.username,
    })),
  });
}
