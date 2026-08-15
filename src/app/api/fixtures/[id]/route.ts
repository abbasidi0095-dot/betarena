import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeFixtures } from "@/lib/serialize";

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
  return NextResponse.json({ fixture: serializeFixtures([fixture])[0] });
}
