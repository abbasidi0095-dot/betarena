import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isConfigured, getTeamLastN, getH2H } from "@/server/adapters/api-football";
import * as footballData from "@/server/adapters/football-data";
import { TTLCache } from "@/lib/stats/memo";
import { buildForm, buildH2H, computeSummary, type H2HEntry } from "@/lib/stats/fixture-stats";

const cache = new TTLCache<StatsPayload>(15 * 60 * 1000);
const teamCache = new TTLCache<footballData.NormalizedTeamMatch[]>(30 * 60 * 1000);

interface StatsPayload {
  homeForm: { result: "W" | "D" | "L"; opponent: string; score: string; date: string }[];
  awayForm: { result: "W" | "D" | "L"; opponent: string; score: string; date: string }[];
  h2h: H2HEntry[];
  statsSummary: { homeWinPct: number; drawPct: number; awayWinPct: number };
  source: "api" | "football-data" | "db";
}

export const dynamic = "force-dynamic";

/** Season history window (previous season during the off-season). */
function seasonWindow(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
  return { from, to: now.toISOString().slice(0, 10) };
}

async function fetchTeamHistory(fdTeamId: number): Promise<footballData.NormalizedTeamMatch[]> {
  const key = String(fdTeamId);
  const cached = teamCache.get(key);
  if (cached) return cached;
  const { from, to } = seasonWindow();
  const rows = await footballData.getTeamMatches(fdTeamId, from, to);
  teamCache.set(key, rows);
  return rows;
}

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
    // Football-data tier — works with the week sync's team ids and needs no
    // api-football key. Form + H2H are derived from each team's season matches.
    if (
      footballData.isConfigured() &&
      fixture.homeTeamFdId &&
      fixture.awayTeamFdId
    ) {
      try {
        const [homeRows, awayRows] = await Promise.all([
          fetchTeamHistory(fixture.homeTeamFdId),
          fetchTeamHistory(fixture.awayTeamFdId),
        ]);
        const homeForm = buildForm(homeRows, "", fixture.homeTeamFdId);
        const awayForm = buildForm(awayRows, "", fixture.awayTeamFdId);
        const h2h = buildH2H(homeRows, awayRows, fixture.homeTeamFdId, fixture.awayTeamFdId);
        payload = {
          homeForm,
          awayForm,
          h2h,
          statsSummary: computeSummary(homeForm, awayForm, h2h),
          source: "football-data",
        };
      } catch {
        payload = null; // fall through to DB fallback
      }
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
