import { generateRealisticOdds, teamsFromHash } from "./odds-model";

export interface FallbackOdds {
  h2h: { home: number; draw: number; away: number };
  totals: { over_2.5: number; under_2.5: number };
  btts: { btts_yes: number; btts_no: number };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Clamp a team strength into the model's supported range. */
export function clampStrength(s: number): number {
  return Math.min(1.95, Math.max(0.85, s));
}

/**
 * Deterministic fixed odds for a fixture with no real odds.
 * Seeded by fixture id + team names: the same fixture always returns the
 * same values, across refreshes and restarts. Values are realistic because
 * they come from the same Poisson score model the demo feed uses.
 */
export function fallbackOdds(fixture: {
  id: string;
  homeTeam: string;
  awayTeam: string;
}): FallbackOdds {
  const home = teamsFromHash(fixture.homeTeam);
  const away = teamsFromHash(fixture.awayTeam);
  // Fixture-scoped jitter (±0.04 strength) so identical matchups in different
  // fixtures still differ, while staying fully deterministic.
  const jitter = (hashString(fixture.id) % 1000) / 1000 - 0.5;
  home.strength = clampStrength(home.strength + jitter * 0.08);
  away.strength = clampStrength(away.strength + jitter * 0.08);
  const o = generateRealisticOdds(home, away);
  // Cap at a bookmaker-plausible ceiling; extreme model outputs (e.g. a
  // 57.0 away win for an ultra-favorite matchup) look broken in the feed.
  const cap = (v: number) => Math.min(35, Math.max(1.01, v));
  return {
    h2h: { home: cap(o.home), draw: cap(o.draw), away: cap(o.away) },
    totals: { "over_2.5": cap(o.over_2_5), "under_2.5": cap(o.under_2_5) },
    btts: { btts_yes: cap(o.btts_yes), btts_no: cap(o.btts_no) },
  };
}
