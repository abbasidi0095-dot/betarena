/**
 * Live-clock helpers shared by the score schedulers.
 */

/** Wall-clock minutes after which a live match is treated as finished. */
export const LIVE_MAX_ELAPSED_MIN = 115;

export interface LiveMatchState {
  minute: number;
  finished: boolean;
}

/**
 * The state a live match should be in given its kickoff and the current wall
 * clock, modelling a standard 90-minute split with a 15-minute break:
 *  - first half: elapsed minutes 1..45
 *  - halftime: 45
 *  - second half: elapsed - 15
 *  - added time: 91..100 for the final ~10 minutes of play
 *  - finished: once far beyond the 90th minute (kickoff + 115 wall minutes,
 *    covering even extreme stoppage), the match is marked FINISHED with the
 *    last known score — the truthful end state when no provider reports it.
 */
export function liveMatchState(kickoff: Date, now: Date): LiveMatchState {
  const elapsed = Math.floor((now.getTime() - kickoff.getTime()) / 60_000);
  if (elapsed <= 0) return { minute: 0, finished: false };
  if (elapsed <= 45) return { minute: elapsed, finished: false };
  if (elapsed <= 60) return { minute: 45, finished: false };
  if (elapsed <= 105) return { minute: elapsed - 15, finished: false };
  if (elapsed <= LIVE_MAX_ELAPSED_MIN) {
    return { minute: 90 + (elapsed - 105), finished: false };
  }
  return { minute: 90, finished: true };
}

/**
 * The minute a live match should show given its kickoff and the current wall
 * clock. See {@link liveMatchState}.
 */
export function liveMinuteFromElapsed(kickoff: Date, now: Date): number {
  return liveMatchState(kickoff, now).minute;
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
