import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeFixtures } from "@/lib/serialize";
import { deriveMarkets } from "@/lib/betting/derived-markets";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fixture = await prisma.fixture.findUnique({
    where: { id },
    include: {
      league: true,
      markets: { include: { odds: true } },
    },
  });
  if (!fixture) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Match not found" } }, { status: 404 });
  }

  const base = { h2h: undefined, totals: undefined } as {
    h2h?: { home: number; draw: number; away: number };
    totals?: { over_2_5: number; under_2_5: number };
  };
  const h2h = fixture.markets.find((m) => m.key === "h2h");
  const totals = fixture.markets.find((m) => m.key === "totals");
  if (h2h) {
    base.h2h = {
      home: h2h.odds.find((o) => o.selectionKey === "home")?.value.toNumber() ?? 2,
      draw: h2h.odds.find((o) => o.selectionKey === "draw")?.value.toNumber() ?? 3.5,
      away: h2h.odds.find((o) => o.selectionKey === "away")?.value.toNumber() ?? 3,
    };
  }
  if (totals) {
    base.totals = {
      over_2_5: totals.odds.find((o) => o.selectionKey === "over_2.5")?.value.toNumber() ?? 1.9,
      under_2_5: totals.odds.find((o) => o.selectionKey === "under_2.5")?.value.toNumber() ?? 1.9,
    };
  }

  const derivedMarkets = deriveMarkets(base, fixture.homeTeam, fixture.awayTeam);

  return NextResponse.json({
    fixture: serializeFixtures([fixture])[0],
    derivedMarkets,
  });
}
