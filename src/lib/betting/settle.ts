export type LegPick = {
  marketKey: "h2h" | "totals" | "btts";
  selectionKey: string;
};

export type LegOutcome = "WON" | "LOST" | "VOID";

/**
 * Resolve a leg against a final score.
 * selectionKeys: h2h -> home|draw|away; totals -> over_2.5|under_2.5;
 * btts -> btts_yes|btts_no. Unknown selections return VOID (callers use VOID
 * for missing markets too, so unknown keys degrade to a refund, never a loss).
 */
export function resolveLeg(
  pick: LegPick,
  score: { home: number; away: number },
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
    default:
      return "VOID";
  }
}
