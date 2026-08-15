import { KeyPool, AllKeysExhaustedError } from "./key-pool";
import { fetchJson, csvEnv, type AdapterResponse } from "./http";

const BASE = "https://api.the-odds-api.com/v4";

/**
 * Popular soccer competitions on The Odds API. Top-6 keeps the free-tier
 * quota sane: ~6 odds calls + ~6 scores calls per cycle across both keys.
 */
export const SPORT_KEYS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
];

export const SPORT_META: Record<string, { name: string; country: string }> = {
  soccer_epl: { name: "Premier League", country: "England" },
  soccer_spain_la_liga: { name: "La Liga", country: "Spain" },
  soccer_italy_serie_a: { name: "Serie A", country: "Italy" },
  soccer_germany_bundesliga: { name: "Bundesliga", country: "Germany" },
  soccer_france_ligue_one: { name: "Ligue 1", country: "France" },
  soccer_uefa_champs_league: { name: "Champions League", country: "Europe" },
};

export interface NormalizedOdds {
  homeTeam: string;
  awayTeam: string;
  commenceTime: Date;
  markets: {
    h2h?: Record<"home" | "draw" | "away", number>;
    totals?: Record<"over_2.5" | "under_2.5", number>;
    btts?: Record<"btts_yes" | "btts_no", number>;
  };
}

let pool: KeyPool | null = null;

function getPool(): KeyPool {
  if (!pool) pool = new KeyPool(csvEnv("ODDS_API_KEYS"));
  return pool;
}

export function isConfigured(): boolean {
  return getPool().size > 0;
}

function averageBookmakerOdds(
  bookmakers: any[],
  extract: (outcomes: any[]) => Record<string, number> | null,
): Record<string, number> | null {
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const b of bookmakers) {
    for (const market of b.markets ?? []) {
      const extracted = extract(market.outcomes ?? []);
      if (!extracted) continue;
      for (const [k, v] of Object.entries(extracted)) {
        acc[k] = acc[k] ?? { sum: 0, n: 0 };
        acc[k].sum += v;
        acc[k].n += 1;
      }
    }
  }
  const out: Record<string, number> = {};
  for (const [k, { sum, n }] of Object.entries(acc)) {
    if (n > 0) out[k] = Math.round((sum / n) * 100) / 100;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function mapEvent(raw: any): NormalizedOdds | null {
  const h2h = averageBookmakerOdds(raw.bookmakers ?? [], (outcomes) => {
    // Soccer h2h outcomes are keyed by the TEAM NAMES + "Draw"
    const rec: Record<string, number> = {};
    for (const o of outcomes) {
      if (o.name === raw.home_team) rec.home = o.price;
      else if (o.name === raw.away_team) rec.away = o.price;
      else if (o.name === "Draw") rec.draw = o.price;
    }
    return Object.keys(rec).length >= 3 ? rec : null;
  });
  if (!h2h) return null;

  const totals = averageBookmakerOdds(raw.bookmakers ?? [], (outcomes) => {
    const rec: Record<string, number> = {};
    for (const o of outcomes) {
      if (o.point === 2.5) rec[o.name === "Over" ? "over_2.5" : "under_2.5"] = o.price;
    }
    return Object.keys(rec).length === 2 ? rec : null;
  });

  const btts = averageBookmakerOdds(raw.bookmakers ?? [], (outcomes) => {
    const rec: Record<string, number> = {};
    for (const o of outcomes) {
      if (o.name === "Yes") rec.btts_yes = o.price;
      if (o.name === "No") rec.btts_no = o.price;
    }
    return Object.keys(rec).length === 2 ? rec : null;
  });

  return {
    homeTeam: raw.home_team ?? "",
    awayTeam: raw.away_team ?? "",
    commenceTime: new Date(raw.commence_time ?? Date.now()),
    markets: {
      h2h: h2h as NormalizedOdds["markets"]["h2h"],
      totals: totals as NormalizedOdds["markets"]["totals"],
      btts: btts as NormalizedOdds["markets"]["btts"],
    },
  };
}

async function call(path: string): Promise<any[]> {
  const p = getPool();
  const lastError = new AllKeysExhaustedError("the-odds-api");
  for (let attempt = 0; attempt < Math.max(p.size, 1); attempt++) {
    let key: string;
    try {
      key = p.next();
    } catch {
      throw lastError;
    }
    // The Odds API v4 requires the key as a query parameter, not a header.
    const sep = path.includes("?") ? "&" : "?";
    const res: AdapterResponse = await fetchJson(`${BASE}${path}${sep}apiKey=${key}`);

    const remaining = Number(res.headers.get("x-requests-remaining"));
    if (!Number.isNaN(remaining)) {
      const reset = res.headers.get("x-requests-reset");
      const resetMs = reset ? new Date(reset).getTime() : Date.now() + 24 * 3600 * 1000;
      p.reportRemaining(key, remaining, resetMs);
    }

    if (res.status === 401) {
      p.reportFailure(key, "auth");
      continue;
    }
    if (res.status === 429) {
      p.reportFailure(key, "quota");
      continue;
    }
    if (res.status !== 200) continue;
    const json = res.json;
    return Array.isArray(json) ? json : [];
  }
  throw lastError;
}

export async function getOddsForSports(sportKeys = SPORT_KEYS): Promise<NormalizedOdds[]> {
  const out: NormalizedOdds[] = [];
  for (const sport of sportKeys) {
    try {
      const raw = await call(
        `/sports/${sport}/odds/?regions=eu&markets=h2h,totals&oddsFormat=decimal`,
      );
      for (const ev of raw) {
        const mapped = mapEvent(ev);
        if (mapped) out.push(mapped);
      }
    } catch {
      // pool exhausted mid-loop: return what we have
      break;
    }
  }
  return out;
}

export interface NormalizedScore {
  providerId: string; // raw event id
  homeTeam: string;
  awayTeam: string;
  commenceTime: Date;
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  lastUpdate: Date | null;
}

/** Scores for matches within the last N days (settlement data). */
export async function getScoresForSports(
  daysFrom = 1,
  sportKeys = SPORT_KEYS,
): Promise<NormalizedScore[]> {
  const out: NormalizedScore[] = [];
  for (const sport of sportKeys) {
    try {
      const raw = await call(`/sports/${sport}/scores/?daysFrom=${daysFrom}`);
      for (const ev of raw as any[]) {
        const scores: Record<string, number> = {};
        for (const s of ev.scores ?? []) {
          scores[s.name] = Number(s.score ?? 0);
        }
        out.push({
          providerId: String(ev.id),
          homeTeam: ev.home_team ?? "",
          awayTeam: ev.away_team ?? "",
          commenceTime: new Date(ev.commence_time ?? Date.now()),
          completed: Boolean(ev.completed),
          homeScore: scores[ev.home_team] ?? null,
          awayScore: scores[ev.away_team] ?? null,
          lastUpdate: ev.last_update ? new Date(ev.last_update) : null,
        });
      }
    } catch {
      break;
    }
  }
  return out;
}

export async function getInPlayOdds(): Promise<NormalizedOdds[]> {
  try {
    const raw = await call(`/sports/?all=false`);
    const liveSports = (raw as any[])
      .filter((s) => s.active && s.group === "Soccer" && s.has_odds)
      .map((s) => s.key);
    const out: NormalizedOdds[] = [];
    for (const sport of liveSports.slice(0, 6)) {
      const events = await call(
        `/sports/${sport}/odds/?regions=eu&markets=h2h&oddsFormat=decimal`,
      );
      for (const ev of events) {
        const mapped = mapEvent(ev);
        if (mapped) out.push(mapped);
      }
    }
    return out;
  } catch {
    return [];
  }
}
