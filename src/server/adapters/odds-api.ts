import { KeyPool, AllKeysExhaustedError } from "./key-pool";
import { fetchJson, csvEnv, type AdapterResponse } from "./http";

const BASE = "https://api.the-odds-api.com/v4";

/**
 * Popular soccer competitions on The Odds API mapped to API-Football league ids.
 * Odds upsert matches by (home, away, kickoff ±3h) so a partial map still works.
 */
export const SPORT_KEYS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
  "soccer_uefa_europa_league",
  "soccer_netherlands_eredivisie",
  "soccer_portugal_primeira_liga",
  "soccer_turkey_super_league",
  "soccer_belgium_first_div",
  "soccer_uefa_nations_league",
];

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
    const rec: Record<string, number> = {};
    for (const o of outcomes) {
      if (o.name === "Home" || o.name === "Away" || o.name === "Draw") {
        rec[o.name.toLowerCase()] = o.price;
      }
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
    const res: AdapterResponse = await fetchJson(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
    });

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
        `/sports/${sport}/odds/?regions=eu&markets=h2h,totals,btts&oddsFormat=decimal`,
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
