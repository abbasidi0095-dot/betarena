import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ fixtures: [], leagues: [] });

  const [fixtures, leagues] = await Promise.all([
    prisma.fixture.findMany({
      where: {
        OR: [{ homeTeam: { contains: q, mode: "insensitive" } }, { awayTeam: { contains: q, mode: "insensitive" } }],
        kickoff: { gte: new Date(Date.now() - 3 * 3600 * 1000) },
      },
      include: { league: true, markets: { include: { odds: true } } },
      take: 12,
      orderBy: { kickoff: "asc" },
    }),
    prisma.league.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 6,
    }),
  ]);

  return NextResponse.json({ fixtures, leagues });
}
