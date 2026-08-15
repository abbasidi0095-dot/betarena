import { KeyPool, AllKeysExhaustedError } from "./key-pool";
import { fetchJson, csvEnv, type AdapterResponse } from "./http";

const BASE = "https://v3.football.api-sports.io";

export interface NormalizedEvent {
  type: "goal" | "card" | "sub";
  minute: number;
  team: "home" | "away";
  player: string;
  zone: number; // 0..11 pitch zone for the visualizer
}

export interface NormalizedFixture {
  providerId: string;
  league: { providerId: string; name: string; country: string; logo?: string; season: number };
  kickoff: Date;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore: number;
  awayScore: number;
  minute: number | null;
  events: NormalizedEvent[];
}

export interface NormalizedLineupPlayer {
  id: string;
  name: string;
  photo?: string;
  pos: string;
}

export interface NormalizedLineup {
  fixtureProviderId: string;
  teamId: string;
  teamName: string;
  formation?: string;
  players: NormalizedLineupPlayer[];
}

/** API-Football league ids for the competitions we track. */
export const LEAGUE_IDS: Record<string, number> = {
  soccer_epl: 39,
  soccer_spain_la_liga: 140,
  soccer_italy_serie_a: 135,
  soccer_germany_bundesliga: 78,
  soccer_france_ligue_one: 61,
  soccer_uefa_champs_league: 2,
  soccer_uefa_europa_league: 3,
  soccer_netherlands_eredivisie: 88,
  soccer_portugal_primeira_liga: 94,
  soccer_turkey_super_league: 203,
  soccer_belgium_first_div: 144,
};

let pool: KeyPool | null = null;

function getPool(): KeyPool {
  if (!pool) pool = new KeyPool(csvEnv("API_FOOTBALL_KEYS"));
  return pool;
}

export function isConfigured(): boolean {
  return getPool().size > 0;
}

function zoneForTeamSide(events: unknown[], index: number): number {
  // Deterministic pseudo-zone: spread goal events across attacking zones.
  return (index * 5 + 3) % 12;
}

function mapStatus(raw: string): NormalizedFixture["status"] {
  if (["NS", "TBD", "PST", "CANC", "ABD", "SUSP"].includes(raw)) return "SCHEDULED";
  if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"].includes(raw)) return "LIVE";
  return "FINISHED"; // FT, AET, PEN
}

function mapFixture(raw: any): NormalizedFixture {
  const events: NormalizedEvent[] = [];
  let goalIndex = 0;
  for (const g of raw.events ?? []) {
    const team: "home" | "away" = g.team?.id === raw.teams?.home?.id ? "home" : "away";
    if (g.type === "Goal") {
      events.push({
        type: "goal",
        minute: g.time?.elapsed ?? 0,
        team,
        player: g.player?.name ?? "Unknown",
        zone: zoneForTeamSide(raw.events, goalIndex++),
      });
    } else if (g.type === "Card") {
      events.push({
        type: "card",
        minute: g.time?.elapsed ?? 0,
        team,
        player: g.player?.name ?? "Unknown",
        zone: (g.time?.elapsed ?? 0) % 12,
      });
    } else if (g.type === "subst") {
      events.push({
        type: "sub",
        minute: g.time?.elapsed ?? 0,
        team,
        player: g.player?.name ?? "Unknown",
        zone: 6,
      });
    }
  }

  const elapsed = raw.fixture?.status?.elapsed ?? null;

  return {
    providerId: String(raw.fixture?.id),
    league: {
      providerId: String(raw.league?.id),
      name: raw.league?.name ?? "Unknown League",
      country: raw.league?.country ?? "",
      logo: raw.league?.logo ?? undefined,
      season: raw.league?.season ?? new Date().getFullYear(),
    },
    kickoff: new Date(raw.fixture?.date ?? Date.now()),
    status: mapStatus(raw.fixture?.status?.short ?? "NS"),
    homeTeam: raw.teams?.home?.name ?? "Home",
    awayTeam: raw.teams?.away?.name ?? "Away",
    homeLogo: raw.teams?.home?.logo ?? undefined,
    awayLogo: raw.teams?.away?.logo ?? undefined,
    homeScore: raw.goals?.home ?? 0,
    awayScore: raw.goals?.away ?? 0,
    minute: elapsed,
    events,
  };
}

async function call(path: string): Promise<unknown[]> {
  const p = getPool();
  const lastError = new AllKeysExhaustedError("api-football");
  // Try up to pool-size attempts so each key gets one shot per call.
  for (let attempt = 0; attempt < Math.max(p.size, 1); attempt++) {
    let key: string;
    try {
      key = p.next();
    } catch {
      throw lastError;
    }
    const res: AdapterResponse = await fetchJson(
      `${BASE}${path}${path.includes("?") ? "&" : "?"}timezone=UTC`,
      { headers: { "x-apisports-key": key } },
    );
    if (res.status === 401 || res.status === 403) {
      p.reportFailure(key, "auth");
      continue;
    }
    if (res.status === 429) {
      p.reportFailure(key, "quota");
      continue;
    }
    const body = res.json as any;
    if (!body || body.errors?.token || Array.isArray(body.errors)) {
      // api-sports returns 200 with an errors object for key problems
      const errs = body?.errors;
      if (errs?.token) {
        p.reportFailure(key, "auth");
        continue;
      }
    }
    if (Array.isArray(body?.response)) return body.response as unknown[];
    return [];
  }
  throw lastError;
}

export async function getFixturesByDate(dateISO: string): Promise<NormalizedFixture[]> {
  const raw = await call(`/fixtures?date=${dateISO}`);
  return raw.map(mapFixture);
}

export async function getFixturesByDateRange(
  fromISO: string,
  toISO: string,
): Promise<NormalizedFixture[]> {
  const raw = await call(`/fixtures?from=${fromISO}&to=${toISO}`);
  return raw.map(mapFixture);
}

export async function getLiveFixtures(): Promise<NormalizedFixture[]> {
  const raw = await call(`/fixtures?live=all`);
  return raw.map(mapFixture);
}

export async function getFinishedLast24h(): Promise<NormalizedFixture[]> {
  const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const raw = await call(`/fixtures?from=${from}&to=${to}&status=FT-AET-PEN`);
  return raw.map(mapFixture);
}

/** Real lineups for specific fixtures (1 request per fixture). */
export async function getLineups(fixtureProviderIds: string[]): Promise<NormalizedLineup[]> {
  const out: NormalizedLineup[] = [];
  for (const fid of fixtureProviderIds) {
    const raw = await call(`/fixtures/lineups?fixture=${fid}`);
    for (const team of raw as any[]) {
      const players = [
        ...(team.startingXI ?? []),
        ...(team.substitutes ?? []),
      ].map((p: any) => ({
        id: String(p.player?.id ?? ""),
        name: p.player?.name ?? "Unknown",
        photo: p.player?.photo ?? undefined,
        pos: p.pos ?? "SUB",
      }));
      out.push({
        fixtureProviderId: fid,
        teamId: String(team.team?.id ?? ""),
        teamName: team.team?.name ?? "",
        formation: team.formation ?? undefined,
        players,
      });
    }
  }
  return out;
}

/** League standings for a season (1 request per league). */
export async function getStandings(
  leagueApiId: number,
  season: number,
): Promise<any[]> {
  const raw = await call(`/standings?league=${leagueApiId}&season=${season}`);
  const standings = (raw as any[])[0]?.league?.standings?.[0] ?? [];
  return standings.map((row: any) => ({
    rank: row.rank,
    team: row.team?.name ?? "?",
    logo: row.team?.logo ?? null,
    played: row.all?.played ?? 0,
    win: row.all?.win ?? 0,
    draw: row.all?.draw ?? 0,
    lose: row.all?.lose ?? 0,
    goalsFor: row.all?.goals?.for ?? 0,
    goalsAgainst: row.all?.goals?.against ?? 0,
    points: row.points ?? 0,
    form: row.form ?? "",
  }));
}
