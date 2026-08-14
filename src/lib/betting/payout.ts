export type LegStatus = "WON" | "LOST" | "VOID" | "OPEN";

type OddsLike = number | "VOID";

export function accaOdds(oddsList: OddsLike[]): number {
  return oddsList.reduce<number>((acc, o) => acc * (o === "VOID" ? 1 : o), 1);
}

export interface ComboToSettle {
  legIds: string[];
  stake: number;
}

export interface CombosSettlement {
  payout: number;
  status: "WON" | "LOST" | "PARTIAL" | "VOID";
}

/**
 * Settle a set of bet combinations given per-leg outcomes.
 * A combination wins iff none of its legs LOST (VOID contributes odds 1.0).
 * Payout per winning combo = floor(stake × product of leg odds, VOID = 1).
 */
export function settleCombos(
  combos: ComboToSettle[],
  legStatus: Record<string, LegStatus>,
  legOdds: Record<string, number>,
): CombosSettlement {
  let payout = 0;
  let won = 0;
  let lost = 0;
  let voidCombos = 0;
  let pending = 0;

  for (const combo of combos) {
    const anyLost = combo.legIds.some((id) => legStatus[id] === "LOST");
    if (anyLost) {
      lost++;
      continue;
    }
    const anyOpen = combo.legIds.some((id) => legStatus[id] === "OPEN");
    if (anyOpen) {
      // Not yet decidable — pay nothing now; a later sweep settles it.
      pending++;
      continue;
    }
    const allVoid = combo.legIds.every((id) => legStatus[id] === "VOID");
    if (allVoid) {
      voidCombos++;
      payout += combo.stake;
      continue;
    }
    const product = combo.legIds.reduce(
      (acc, id) => acc * (legStatus[id] === "VOID" ? 1 : (legOdds[id] ?? 1)),
      1,
    );
    payout += Math.floor(combo.stake * product);
    won++;
  }

  let status: CombosSettlement["status"];
  if (lost === combos.length && combos.length > 0) {
    status = "LOST";
  } else if (voidCombos === combos.length && combos.length > 0) {
    status = "VOID";
  } else if (won > 0 && (lost > 0 || voidCombos > 0 || pending > 0)) {
    status = "PARTIAL";
  } else if (won > 0) {
    status = "WON";
  } else if (voidCombos > 0 || pending > 0) {
    status = "PARTIAL";
  } else {
    status = "LOST";
  }

  return { payout, status };
}
