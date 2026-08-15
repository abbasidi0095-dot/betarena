import { KeyPool, AllKeysExhaustedError } from "./key-pool";
import { fetchJson, csvEnv, type AdapterResponse } from "./http";
import { parseFootballDataMinute } from "@/lib/live/minute";

const BASE = "https://api.football-data.org/v4";

/**
 * football-data.org adapter — used for true minute-by-minute live updates.
 * Free tier: 10 requests/min per key (no daily cap), so 4 keys rotate easily
 * behind one poll per minute.
 */

export interface NormalizedLiveMatch {
  providerId: string; // football-data match id
  homeTeam: string;
  awayTeam: string;
  homeCrest?: string;
  awayCrest?: string;
  kickoff: Date;
  status: "LIVE" | "FINISHED";
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface NormalizedWeekFixture {
  providerId: string; // "fd:<match id>"
  competition: { providerId: string; name: string; emblem?: string };
  kickoff: Date;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  homeCrest?: string;
  awayCrest?: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface NormalizedTeamMatch {
  providerId: string;
  competition: string;
  kickoff: Date;
  status: "FINISHED";
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
}

let pool: KeyPool | null = null;

function getPool(): KeyPool {
  if (!pool) pool = new KeyPool(csvEnv("FOOTBALL_DATA_KEYS"));
  return pool;
}

export function isConfigured(): boolean {
  return getPool().size > 0;
}

function mapStatus(raw: string): NormalizedLiveMatch["status"] | null {
  if (["IN_PLAY", "PAUSED", "LIVE"].includes(raw)) return "LIVE";
  if (["FINISHED", "AWARDED"].includes(raw)) return "FINISHED";
  return null; // SCHEDULED/TIMED/POSTPONED/CANCELLED etc — not our concern
}

function mapMatch(raw: any): NormalizedLiveMatch | null {
  const status = mapStatus(raw.status ?? "");
  if (!status) return null;
  const homeScore = raw.score?.fullTime?.home ?? null;
  const awayScore = raw.score?.fullTime?.away ?? null;
  return {
    providerId: String(raw.id),
    homeTeam: raw.homeTeam?.name ?? raw.homeTeam?.shortName ?? "",
    awayTeam: raw.awayTeam?.name ?? raw.awayTeam?.shortName ?? "",
    homeCrest: raw.homeTeam?.crest ?? undefined,
    awayCrest: raw.awayTeam?.crest ?? undefined,
    kickoff: new Date(raw.utcDate ?? Date.now()),
    status,
    minute: parseFootballDataMinute(raw.minute),
    homeScore,
    awayScore,
  };
}

async function call(path: string): Promise<any[]> {
  const p = getPool();
  const lastError = new AllKeysExhaustedError("football-data");
  for (let attempt = 0; attempt < Math.max(p.size, 1); attempt++) {
    let key: string;
    try {
      key = p.next();
    } catch {
      throw lastError;
    }
    const res: AdapterResponse = await fetchJson(`${BASE}${path}`, {
      headers: { "X-Auth-Token": key },
    });
    if (res.status === 401 || res.status === 403) {
      p.reportFailure(key, "auth");
      continue;
    }
    if (res.status === 429) {
      p.reportFailure(key, "quota");
      continue;
    }
    if (res.status !== 200) continue;
    const json = res.json as any;
    return Array.isArray(json?.matches) ? (json.matches as any[]) : [];
  }
  throw lastError;
}

/** All matches currently in play or finished (single request). */
export async function getLiveMatches(): Promise<NormalizedLiveMatch[]> {
  const raw = await call("/matches?status=IN_PLAY,PAUSED,FINISHED");
  const out: NormalizedLiveMatch[] = [];
  for (const m of raw) {
    const mapped = mapMatch(m);
    if (mapped) out.push(mapped);
  }
  return out;
}

export async function getInPlayMatches(): Promise<NormalizedLiveMatch[]> {
  const raw = await call("/matches?status=IN_PLAY,PAUSED");
  const out: NormalizedLiveMatch[] = [];
  for (const m of raw) {
    const mapped = mapMatch(m);
    if (mapped) out.push(mapped);
  }
  return out;
}

/** Full-week fixture list across ALL competitions (single request). */
export async function getMatchesRange(
  dateFrom: string,
  dateTo: string,
): Promise<NormalizedWeekFixture[]> {
  const raw = await call(`/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
  const out: NormalizedWeekFixture[] = [];
  for (const m of raw as any[]) {
    const status =
      ["IN_PLAY", "PAUSED"].includes(m.status ?? "")
        ? "LIVE"
        : ["FINISHED", "AWARDED"].includes(m.status ?? "")
          ? "FINISHED"
          : "SCHEDULED";
    out.push({
      providerId: `fd:${m.id}`,
      competition: {
        providerId: `fd:${m.competition?.id ?? ""}`,
        name: m.competition?.name ?? "Unknown",
        emblem: m.competition?.emblem ?? undefined,
      },
      kickoff: new Date(m.utcDate ?? Date.now()),
      status,
      homeTeam: m.homeTeam?.name ?? m.homeTeam?.shortName ?? "",
      awayTeam: m.awayTeam?.name ?? m.awayTeam?.shortName ?? "",
      homeTeamId: m.homeTeam?.id ?? undefined,
      awayTeamId: m.awayTeam?.id ?? undefined,
      homeCrest: m.homeTeam?.crest ?? undefined,
      awayCrest: m.awayTeam?.crest ?? undefined,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
    });
  }
  return out;
}

/**
 * A team's finished matches over a window (covers the previous season during
 * the off-season, so form and H2H still work before the new season starts).
 */
export async function getTeamMatches(
  teamId: number,
  dateFrom: string,
  dateTo: string,
): Promise<NormalizedTeamMatch[]> {
  const raw = await call(`/teams/${teamId}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`);
  const out: NormalizedTeamMatch[] = [];
  for (const m of raw) {
    const homeScore = m.score?.fullTime?.home;
    const awayScore = m.score?.fullTime?.away;
    if (homeScore === null || awayScore === null) continue;
    out.push({
      providerId: String(m.id),
      competition: m.competition?.name ?? "Unknown",
      kickoff: new Date(m.utcDate ?? Date.now()),
      status: "FINISHED",
      homeTeam: m.homeTeam?.name ?? m.homeTeam?.shortName ?? "",
      awayTeam: m.awayTeam?.name ?? m.awayTeam?.shortName ?? "",
      homeTeamId: m.homeTeam?.id ?? teamId,
      awayTeamId: m.awayTeam?.id ?? teamId,
      homeScore,
      awayScore,
    });
  }
  return out;
}
