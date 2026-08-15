export type MarketKey =
  | "h2h"
  | "totals"
  | "btts"
  | "dc"
  | "handicap"
  | "exact"
  | "scorer";

export type LegPick = {
  marketKey: MarketKey;
  selectionKey: string;
};

export type LegOutcome = "WON" | "LOST" | "VOID";

interface GoalEvent {
  type: string;
  minute: number;
  team: string;
  player: string;
  zone?: number;
}

/**
 * Resolve a leg against a final score (and optionally the goal event feed).
 * Unknown selections/markets degrade to VOID — never a surprise loss.
 */
export function resolveLeg(
  pick: LegPick,
  score: { home: number; away: number },
  events: GoalEvent[] = [],
): LegOutcome {
  const total = score.home + score.away;

  switch (pick.marketKey) {
    case "h2h": {
      if (pick.selectionKey === "home")
        return score.home > score.away ? "WON" : "LOST";
      if (pick.selectionKey === "away")
        return score.away > score.home ? "WON" : "LOST";
      if (pick.selectionKey === "draw")
        return score.home === score.away ? "WON" : "LOST";
      return "VOID";
    }
    case "totals": {
      if (pick.selectionKey === "over_2.5") return total >= 3 ? "WON" : "LOST";
      if (pick.selectionKey === "under_2.5") return total <= 2 ? "WON" : "LOST";
      return "VOID";
    }
    case "btts": {
      const both = score.home > 0 && score.away > 0;
      if (pick.selectionKey === "btts_yes") return both ? "WON" : "LOST";
      if (pick.selectionKey === "btts_no") return both ? "LOST" : "WON";
      return "VOID";
    }
    case "dc": {
      const homeWin = score.home > score.away;
      const awayWin = score.away > score.home;
      const draw = score.home === score.away;
      if (pick.selectionKey === "home_or_draw") return homeWin || draw ? "WON" : "LOST";
      if (pick.selectionKey === "away_or_draw") return awayWin || draw ? "WON" : "LOST";
      if (pick.selectionKey === "home_or_away") return homeWin || awayWin ? "WON" : "LOST";
      return "VOID";
    }
    case "handicap": {
      const m = pick.selectionKey.match(/^(home|away)_([+-]\d+)$/);
      if (!m) return "VOID";
      const line = Number(m[2]);
      if (m[1] === "home") {
        const homeAdjusted = score.home + line;
        if (homeAdjusted > score.away) return "WON";
        if (homeAdjusted < score.away) return "LOST";
        return "VOID"; // push — stake returns
      }
      const awayAdjusted = score.away + line;
      if (awayAdjusted > score.home) return "WON";
      if (awayAdjusted < score.home) return "LOST";
      return "VOID"; // push — stake returns
    }
    case "exact": {
      if (pick.selectionKey === "g0") return total === 0 ? "WON" : "LOST";
      if (pick.selectionKey === "g1") return total === 1 ? "WON" : "LOST";
      if (pick.selectionKey === "g2") return total === 2 ? "WON" : "LOST";
      if (pick.selectionKey === "g3") return total === 3 ? "WON" : "LOST";
      if (pick.selectionKey === "g4") return total >= 4 ? "WON" : "LOST";
      return "VOID";
    }
    case "scorer": {
      // selectionKey format: "scorer:<team>:<player name>"
      const full = pick.selectionKey.startsWith("scorer:")
        ? pick.selectionKey.slice("scorer:".length)
        : "";
      if (!full) return "VOID";
      const player = full.includes(":") ? full.slice(full.indexOf(":") + 1) : full;
      const scored = events.some(
        (e) => e.type === "goal" && (e.player === player || e.player?.includes(player)),
      );
      return scored ? "WON" : "LOST";
    }
    default:
      return "VOID";
  }
}
