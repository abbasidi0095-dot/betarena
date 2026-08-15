/**
 * Derived markets: given base odds (1X2, O/U 2.5, BTTS) — either from a real
 * provider or the demo model — fit a Poisson score model and produce the
 * extended Betclic-style market set: double chance, handicap, exact goals,
 * BTTS and anytime scorer (players derived deterministically from team names).
 *
 * Everything is probability-consistent with the base odds; markets get their
 * own small margin so the numbers look like a pro book.
 */

import { inverseProb, starPlayersFor } from "./odds-model";

export interface BaseOdds {
  h2h?: { home: number; draw: number; away: number };
  totals?: { over_2_5: number; under_2_5: number };
  btts?: { btts_yes: number; btts_no: number };
}

export interface DerivedSelection {
  selectionKey: string;
  name: string;
  odds: number;
}

export interface DerivedMarkets {
  dc: DerivedSelection[];
  handicap: DerivedSelection[];
  exact: DerivedSelection[];
  btts: DerivedSelection[];
  scorers: DerivedSelection[];
}

function poisson(lambda: number, k: number): number {
  let acc = Math.exp(-lambda) * lambda ** k;
  for (let i = 2; i <= k; i++) acc *= 1 / i;
  return acc;
}

interface ScoreModel {
  p: (hg: number, ag: number) => number;
  p1: number;
  pX: number;
  p2: number;
  pOver: number;
  pBtts: number;
  pHomeWinBy: (margin: number) => number;
  pAwayCover: (line: number) => number;
}

function scoreProbs(lambdaH: number, lambdaA: number, upTo = 7): ScoreModel {
  const ph = Array.from({ length: upTo + 1 }, (_, k) => poisson(lambdaH, k));
  const pa = Array.from({ length: upTo + 1 }, (_, k) => poisson(lambdaA, k));
  const sh = ph.reduce((a, b) => a + b, 0);
  const sa = pa.reduce((a, b) => a + b, 0);
  const nh = ph.map((x) => x / sh);
  const na = pa.map((x) => x / sa);
  const p = (hg: number, ag: number) =>
    hg <= upTo && ag <= upTo ? nh[hg] * na[ag] : 0;
  let p1 = 0;
  let pX = 0;
  let p2 = 0;
  let pOver = 0;
  let pBtts = 0;
  for (let hg = 0; hg <= upTo; hg++)
    for (let ag = 0; ag <= upTo; ag++) {
      const q = p(hg, ag);
      if (hg > ag) p1 += q;
      else if (hg === ag) pX += q;
      else p2 += q;
      if (hg + ag >= 3) pOver += q;
      if (hg > 0 && ag > 0) pBtts += q;
    }
  const pHomeWinBy = (margin: number) => {
    let acc = 0;
    for (let hg = 0; hg <= upTo; hg++)
      for (let ag = 0; ag <= upTo; ag++) if (hg - ag >= margin) acc += p(hg, ag);
    return acc;
  };
  const pAwayCover = (line: number) => {
    let acc = 0;
    for (let hg = 0; hg <= upTo; hg++)
      for (let ag = 0; ag <= upTo; ag++) if (ag + line > hg) acc += p(hg, ag);
    return acc;
  };
  return { p, p1, pX, p2, pOver, pBtts, pHomeWinBy, pAwayCover };
}

/** Fit lambdas minimizing deviation from target probabilities. */
function fitLambdas(targets: {
  p1?: number;
  pX?: number;
  p2?: number;
  pOver?: number;
}): { lambdaH: number; lambdaA: number } {
  let best = { lambdaH: 1.3, lambdaA: 1.1 };
  let bestErr = Infinity;
  for (let lh = 0.3; lh <= 4.0; lh += 0.1) {
    for (let la = 0.3; la <= 3.5; la += 0.1) {
      const m = scoreProbs(lh, la);
      const err =
        (targets.p1 === undefined ? 0 : Math.abs(m.p1 - targets.p1)) +
        (targets.pX === undefined ? 0 : Math.abs(m.pX - targets.pX) * 1.5) +
        (targets.p2 === undefined ? 0 : Math.abs(m.p2 - targets.p2)) +
        (targets.pOver === undefined ? 0 : Math.abs(m.pOver - targets.pOver));
      if (err < bestErr) {
        bestErr = err;
        best = { lambdaH: lh, lambdaA: la };
      }
    }
  }
  return best;
}

function toFair(odds: number): number {
  return inverseProb(Math.max(odds, 1.0001));
}

function removeMargin(...probs: number[]): number[] {
  const total = probs.reduce((a, b) => a + b, 0);
  return probs.map((p) => p / total);
}

function price(prob: number, margin = 1.07): number {
  return Math.max(1.01, Math.round((1 / (prob * margin)) * 100) / 100);
}

export function deriveMarkets(
  base: BaseOdds,
  homeTeam: string,
  awayTeam: string,
): DerivedMarkets {
  const h2h = base.h2h;
  const totals = base.totals;

  let p1: number | undefined;
  let pX: number | undefined;
  let p2: number | undefined;
  let pOver: number | undefined;

  if (h2h) {
    [p1, pX, p2] = removeMargin(toFair(h2h.home), toFair(h2h.draw), toFair(h2h.away));
  }
  if (totals) {
    const [o] = removeMargin(toFair(totals.over_2_5), toFair(totals.under_2_5));
    pOver = o;
  }

  const { lambdaH, lambdaA } = fitLambdas({ p1, pX, p2, pOver });
  const model = scoreProbs(lambdaH, lambdaA);

  // Double chance
  const dc: DerivedSelection[] = [];
  if (p1 !== undefined && pX !== undefined && p2 !== undefined) {
    dc.push(
      { selectionKey: "home_or_draw", name: `${homeTeam} or Draw`, odds: price(p1 + pX) },
      { selectionKey: "home_or_away", name: `${homeTeam} or ${awayTeam}`, odds: price(1 - pX) },
      { selectionKey: "away_or_draw", name: `${awayTeam} or Draw`, odds: price(p2 + pX) },
    );
  }

  // Handicap: home -1, home -2, away +1, away +2
  const handicap: DerivedSelection[] = [
    { selectionKey: "home_-1", name: `${homeTeam} -1`, odds: price(model.pHomeWinBy(1)) },
    { selectionKey: "home_-2", name: `${homeTeam} -2`, odds: price(model.pHomeWinBy(2)) },
    { selectionKey: "away_+1", name: `${awayTeam} +1`, odds: price(model.pAwayCover(1)) },
    { selectionKey: "away_+2", name: `${awayTeam} +2`, odds: price(model.pAwayCover(2)) },
  ];

  // Exact goals: 0, 1, 2, 3, 4+
  const pExact4 = Math.max(
    0.02,
    1 -
      (model.p(0, 0) +
        model.p(1, 0) +
        model.p(0, 1) +
        model.p(2, 0) +
        model.p(1, 1) +
        model.p(0, 2) +
        model.p(3, 0) +
        model.p(2, 1) +
        model.p(1, 2) +
        model.p(0, 3)),
  );
  const exact: DerivedSelection[] = [
    { selectionKey: "g0", name: "0 goals", odds: price(model.p(0, 0)) },
    { selectionKey: "g1", name: "1 goal", odds: price(model.p(1, 0) + model.p(0, 1)) },
    {
      selectionKey: "g2",
      name: "2 goals",
      odds: price(model.p(2, 0) + model.p(1, 1) + model.p(0, 2)),
    },
    {
      selectionKey: "g3",
      name: "3 goals",
      odds: price(model.p(3, 0) + model.p(2, 1) + model.p(1, 2) + model.p(0, 3)),
    },
    { selectionKey: "g4", name: "4+ goals", odds: price(pExact4) },
  ];

  // BTTS
  const btts: DerivedSelection[] = [
    { selectionKey: "btts_yes", name: "Both teams to score — Yes", odds: price(model.pBtts) },
    { selectionKey: "btts_no", name: "Both teams to score — No", odds: price(1 - model.pBtts) },
  ];

  // Anytime scorer: deterministic star players, odds from team goal share
  const scorerOdds = (teamLambda: number, index: number) =>
    Math.min(0.55, Math.max(0.05, (0.35 + teamLambda) * 0.16 * (1.4 - index * 0.28)));
  const scorers: DerivedSelection[] = [];
  starPlayersFor(homeTeam).forEach((p, i) =>
    scorers.push({ selectionKey: p.id, name: p.name, odds: price(scorerOdds(lambdaH, i), 1.1) }),
  );
  starPlayersFor(awayTeam).forEach((p, i) =>
    scorers.push({ selectionKey: p.id, name: p.name, odds: price(scorerOdds(lambdaA, i), 1.1) }),
  );

  return { dc, handicap, exact, btts, scorers };
}
