import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeFixtures } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") ?? "top";
  const leagueId = req.nextUrl.searchParams.get("leagueId");
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0));
  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 150)));

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
                lte: new Date(now.getTime() + 8 * 24 * 3600 * 1000),
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
    skip: offset,
    take: limit + 1,
  });
  const hasMore = fixtures.length > limit;
  const page = fixtures.slice(0, limit);

  return NextResponse.json({
    fixtures: serializeFixtures(page),
    dataStale: false,
    hasMore,
    offset: offset + page.length,
  });
}
