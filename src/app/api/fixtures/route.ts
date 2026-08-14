import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") ?? "top";
  const leagueId = req.nextUrl.searchParams.get("leagueId");

  const now = new Date();
  const where =
    scope === "live"
      ? { status: "LIVE" as const }
      : scope === "upcoming"
        ? { status: "SCHEDULED" as const, kickoff: { gte: now } }
        : leagueId
          ? { leagueId, kickoff: { gte: new Date(now.getTime() - 3 * 3600 * 1000) } }
          : {
              kickoff: {
                gte: new Date(now.getTime() - 3 * 3600 * 1000),
                lte: new Date(now.getTime() + 4 * 24 * 3600 * 1000),
              },
            };

  const fixtures = await prisma.fixture.findMany({
    where,
    include: {
      league: true,
      markets: {
        include: { odds: true },
      },
    },
    orderBy: [{ status: "desc" }, { kickoff: "asc" }],
    take: scope === "live" ? 50 : 40,
  });

  return NextResponse.json({ fixtures, dataStale: false });
}
