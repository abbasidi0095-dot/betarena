import { generateRealisticOdds, teamsFromHash } from "./odds-model";

export interface FallbackOdds {
  h2h: { home: number; draw: number; away: number };
  totals: { "over_2.5": number; "under_2.5": number };
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

export interface LiveScoreState {
  homeScore: number;
  awayScore: number;
  minute: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const capLive = (v: number) => Math.min(35, Math.max(1.01, v));

/**
 * Deterministic in-play odds for a live fixture, derived from the pre-match
 * fallback odds plus the current score and minute. Same inputs always return
 * the same outputs, so repeated polls are stable; any score change or minute
 * tick shifts the odds. A goal lead shortens the leader's odds (more so the
 * later it happens), level scores push the draw shorter as the end nears,
 * goals on the board push totals toward over, and BTTS follows whether both
 * sides have scored.
 */
export function liveFallbackOdds(
  fixture: { id: string; homeTeam: string; awayTeam: string },
  live: LiveScoreState,
): FallbackOdds {
  const base = fallbackOdds(fixture);
  const minute = Math.min(120, Math.max(0, live.minute));
  // Fraction of regulation time remaining (floor 5% so full-time is defined).
  const r = Math.min(1, Math.max(0.05, (90 - minute) / 90));
  const d = live.homeScore - live.awayScore;
  const goals = live.homeScore + live.awayScore;

  // H2H: move probability mass toward the leader, scaled by how little time
  // is left (a late lead is far more decisive than an early one). Calibrated
  // to real in-play shapes: 1-0 at 80' ≈ 1.15-1.25 home, 0-0 at 90' ≈ 1.2-1.5
  // draw, a 2-goal lead at 80' ≈ 1.05-1.1 home.
  let ph = 1 / base.h2h.home;
  let pd = 1 / base.h2h.draw;
  let pa = 1 / base.h2h.away;
  const pre = ph + pd + pa;
  ph /= pre;
  pd /= pre;
  pa /= pre;

  const late = 1 - r; // 0 at kickoff → ~0.95 at the 90th minute
  const shift = Math.exp(d * (0.12 + 0.95 * late));
  ph *= shift;
  pa /= shift;
  if (d === 0) pd *= Math.exp(2.2 * Math.pow(late, 1.3));
  else pd *= Math.exp(-1.1 * late);

  const post = ph + pd + pa;
  const h2h = {
    home: round2(capLive(1 / (ph / post))),
    draw: round2(capLive(1 / (pd / post))),
    away: round2(capLive(1 / (pa / post))),
  };

  // Totals: goals already scored push toward over, elapsed time toward under.
  let po = 1 / base.totals["over_2.5"];
  po *= Math.exp(goals * 0.35 * (2 - r) - 0.35 * (1 - r));
  po = Math.min(0.97, Math.max(0.03, po));
  const totals = {
    "over_2.5": round2(capLive(1 / po)),
    "under_2.5": round2(capLive(1 / (1 - po))),
  };

  // BTTS: both sides scoring makes "yes" much likelier, a one-sided or
  // scoreless game pushes "no".
  let py = 1 / base.btts.btts_yes;
  if (live.homeScore > 0 && live.awayScore > 0) py *= Math.exp(0.8 * (2 - r));
  else if (live.homeScore > 0 || live.awayScore > 0) py *= Math.exp(-0.8 * (2 - r));
  else py *= Math.exp(-0.25 * (1 - r));
  py = Math.min(0.97, Math.max(0.03, py));
  const btts = {
    btts_yes: round2(capLive(1 / py)),
    btts_no: round2(capLive(1 / (1 - py))),
  };

  return { h2h, totals, btts };
}
