/**
 * Live-clock helpers shared by the score schedulers.
 */

/**
 * The minute a live match should show given its kickoff and the current wall
 * clock, modelling a standard 90-minute half split with a 15-minute break:
 *  - first half: elapsed minutes 1..45
 *  - halftime: 45
 *  - second half: elapsed - 15, capped at 90
 * This only ever moves forward from the kickoff time; it says nothing about
 * stoppage time or whether the match has actually finished.
 */
export function liveMinuteFromElapsed(kickoff: Date, now: Date): number {
  const elapsed = Math.floor((now.getTime() - kickoff.getTime()) / 60_000);
  if (elapsed <= 0) return 0;
  if (elapsed <= 45) return elapsed;
  if (elapsed <= 60) return 45;
  return Math.min(90, elapsed - 15);
}

/**
 * Parse a football-data.org live `minute` value. The v4 API reports it as a
 * string ("17", "90+2", "45+1") or a number; anything else is unknown.
 */
export function parseFootballDataMinute(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const m = /^\s*(\d+)(?:\s*\+\s*(\d+))?/.exec(raw.trim());
  if (!m) return null;
  return Number(m[1]) + (m[2] ? Number(m[2]) : 0);
}
