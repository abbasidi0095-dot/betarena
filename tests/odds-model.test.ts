import { describe, it, expect } from "vitest";
import {
  generateRealisticOdds,
  teamsFromHash,
  starPlayersFor,
  inverseProb,
} from "@/lib/betting/odds-model";

describe("generateRealisticOdds — pro-bookmaker shape", () => {
  it("favorite gets lower odds than underdog", () => {
    const o = generateRealisticOdds(teamsFromHash("Real Madrid"), teamsFromHash("Getafe"));
    expect(o.home).toBeLessThan(o.draw);
    expect(o.draw).toBeLessThan(o.away);
  });

  it("even matchup produces home-advantaged odds (2.3/3.3/3.6 shape)", () => {
    const o = generateRealisticOdds(teamsFromHash("Team A"), teamsFromHash("Team B"));
    expect(o.home).toBeGreaterThan(1.9);
    expect(o.home).toBeLessThan(2.8);
    expect(o.away).toBeGreaterThan(2.6);
    expect(o.away).toBeLessThan(4.2);
    expect(o.draw).toBeGreaterThan(3.0);
    expect(o.draw).toBeLessThan(4.0);
  });

  it("has a bookmaker margin (overround) of 3–9%", () => {
    const o = generateRealisticOdds(teamsFromHash("Arsenal"), teamsFromHash("Brentford"));
    const margin = inverseProb(o.home) + inverseProb(o.draw) + inverseProb(o.away) - 1;
    expect(margin).toBeGreaterThan(0.03);
    expect(margin).toBeLessThan(0.09);
  });

  it("totals and BTTS are consistent with the match model", () => {
    const o = generateRealisticOdds(teamsFromHash("Inter"), teamsFromHash("Juventus"));
    const bothSides = inverseProb(o.over_2_5) + inverseProb(o.under_2_5);
    const bttsSides = inverseProb(o.btts_yes) + inverseProb(o.btts_no);
    expect(bothSides).toBeGreaterThan(1.02);
    expect(bothSides).toBeLessThan(1.09);
    expect(bttsSides).toBeGreaterThan(1.02);
    expect(bttsSides).toBeLessThan(1.09);
  });

  it("strong favorite odds look like a pro book (1.1–1.5)", () => {
    const o = generateRealisticOdds(teamsFromHash("Man City"), teamsFromHash("Luton"));
    expect(o.home).toBeLessThan(1.5);
  });

  it("derived markets: double chance, exact goals, handicap, scorers", () => {
    const o = generateRealisticOdds(teamsFromHash("Bayern"), teamsFromHash("Mainz"));
    // exact goals probabilities sum ≈ 1
    const exactSum =
      inverseProb(o.exact_0) +
      inverseProb(o.exact_1) +
      inverseProb(o.exact_2) +
      inverseProb(o.exact_3) +
      inverseProb(o.exact_4);
    // exact goals implied probabilities sum ≈ bookmaker margin (overround)
    expect(exactSum).toBeGreaterThan(1.03);
    expect(exactSum).toBeLessThan(1.09);

    expect(o.dc.home_or_draw).toBeLessThan(o.dc.home_or_away);
    expect(o.handicap.home_1.odds).toBeLessThan(o.handicap.home_2.odds);
    expect(o.scorers.length).toBeGreaterThanOrEqual(3);
    expect(o.scorers[0].odds).toBeGreaterThan(1.5);
  });
});

describe("teamsFromHash / starPlayersFor", () => {
  it("is deterministic", () => {
    expect(teamsFromHash("Arsenal")).toEqual(teamsFromHash("Arsenal"));
    expect(starPlayersFor("Arsenal")).toEqual(starPlayersFor("Arsenal"));
  });

  it("produces plausible squad names", () => {
    const players = starPlayersFor("Real Madrid");
    expect(players.length).toBeGreaterThanOrEqual(4);
    for (const p of players) {
      expect(p.name.split(" ").length).toBeGreaterThanOrEqual(2);
      expect(p.position).toBeOneOf(["ST", "W", "AM", "CM", "DF", "GK"]);
    }
  });
});
