import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { unauthorized, jsonError } from "@/lib/api";
import { placeBetSchema } from "@/lib/validation";
import { placeBets, PlacementError } from "@/lib/bets/place";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  const status = req.nextUrl.searchParams.get("status") ?? "open";

  const bets = await prisma.bet.findMany({
    where: { userId: session.id, status: status === "open" ? "OPEN" : { not: "OPEN" } },
    include: {
      legs: { include: { fixture: { include: { league: true } } } },
      combinations: true,
    },
    orderBy: { placedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ bets });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = placeBetSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION", parsed.error.issues[0].message, 422);
  }

  try {
    const result = await placeBets(session.id, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlacementError) {
      return jsonError(err.code, err.message, 422);
    }
    console.error("place bet failed", err);
    return jsonError("INTERNAL", "Could not place bet", 500);
  }
}
