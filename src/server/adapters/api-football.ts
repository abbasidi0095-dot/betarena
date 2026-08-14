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
  homeScore: number;
  awayScore: number;
  minute: number | null;
  events: NormalizedEvent[];
}

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
