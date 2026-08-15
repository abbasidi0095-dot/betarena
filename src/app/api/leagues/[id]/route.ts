import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Real league standings (synced daily from API-Football). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const league = await prisma.league.findUnique({
    where: { id },
    select: { id: true, name: true, country: true, logo: true, season: true, standings: true },
  });
  if (!league) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "League not found" } }, { status: 404 });
  }
  return NextResponse.json({ league });
}
