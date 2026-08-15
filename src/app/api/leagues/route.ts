import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const leagues = await prisma.league.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      fixtures: {
        where: {
          kickoff: {
            gte: new Date(Date.now() - 3 * 3600 * 1000),
            lte: new Date(Date.now() + 10 * 24 * 3600 * 1000),
          },
        },
        select: { id: true },
      },
    },
  });
  return NextResponse.json({
    leagues: leagues
      .filter((l) => l.fixtures.length > 0)
      .map((l) => ({
        id: l.id,
        name: l.name,
        country: l.country,
        logo: l.logo,
        fixtureCount: l.fixtures.length,
      })),
  });
}
