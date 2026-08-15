import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isConfigured, getTeamLastN, getH2H } from "@/server/adapters/api-football";
import { TTLCache } from "@/lib/stats/memo";
import { buildForm, computeSummary } from "@/lib/stats/fixture-stats";

const cache = new TTLCache<StatsPayload>(15 * 60 * 1000);

interface StatsPayload {
  homeForm: { result: "W" | "D" | "L"; opponent: string; score: string; date: string }[];
  awayForm: { result: "W" | "D" | "L"; opponent: string; score: string; date: string }[];
  h2h: { homeTeam: string; awayTeam: string; score: string; date: string }[];
  statsSummary: { homeWinPct: number; drawPct: number; awayWinPct: number };
  source: "api" | "db";
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cached = cache.get(id);
  if (cached) return NextResponse.json(cached);

  const fixture = await prisma.fixture.findUnique({ where: { id } });
  if (!fixture) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });

  let payload: StatsPayload | null = null;
  if (isConfigured() && fixture.homeTeamId && fixture.awayTeamId) {
    try {
      const [homeRaw, awayRaw, h2hRaw] = await Promise.all([
        getTeamLastN(fixture.homeTeamId),
        getTeamLastN(fixture.awayTeamId),
        getH2H(fixture.homeTeamId, fixture.awayTeamId),
      ]);
      const toRows = (raw: typeof homeRaw) =>
        raw.map((f) => ({
          homeTeam: f.homeTeam,
          awayTeam: f.awayTeam,
          homeScore: f.homeScore,
          awayScore: f.awayScore,
          kickoff: f.kickoff,
        }));
      const homeForm = buildForm(toRows(homeRaw), fixture.homeTeam);
      const awayForm = buildForm(toRows(awayRaw), fixture.awayTeam);
      const h2h = h2hRaw.slice(0, 5).map((f) => ({
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        score: `${f.homeScore} - ${f.awayScore}`,
        date: f.kickoff.toISOString(),
      }));
      payload = {
        homeForm,
        awayForm,
        h2h,
        statsSummary: computeSummary(homeForm, awayForm, h2h),
        source: "api",
      };
    } catch {
      payload = null; // fall through to DB fallback
    }
  }

  if (!payload) {
    const mk = (f: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; kickoff: Date }) => ({
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      kickoff: f.kickoff,
    });
    const rows = await prisma.fixture.findMany({
      where: {
        status: "FINISHED",
        OR: [{ homeTeam: fixture.homeTeam }, { awayTeam: fixture.homeTeam }],
      },
      orderBy: { kickoff: "desc" },
      take: 5,
    });
    const rowsAway = await prisma.fixture.findMany({
      where: {
        status: "FINISHED",
        OR: [{ homeTeam: fixture.awayTeam }, { awayTeam: fixture.awayTeam }],
      },
      orderBy: { kickoff: "desc" },
      take: 5,
    });
    const homeForm = buildForm(rows.map(mk), fixture.homeTeam);
    const awayForm = buildForm(rowsAway.map(mk), fixture.awayTeam);
    payload = {
      homeForm,
      awayForm,
      h2h: [],
      statsSummary: computeSummary(homeForm, awayForm, []),
      source: "db",
    };
  }

  cache.set(id, payload);
  return NextResponse.json(payload);
}
