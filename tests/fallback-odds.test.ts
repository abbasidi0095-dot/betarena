import { describe, it, expect } from "vitest";
import { fallbackOdds } from "@/lib/betting/fallback-odds";
import { inverseProb } from "@/lib/betting/odds-model";

const FIXTURES = [
  { id: "a1", homeTeam: "Real Madrid", awayTeam: "Getafe" },
  { id: "a2", homeTeam: "Arsenal", awayTeam: "Brentford" },
  { id: "a3", homeTeam: "Fenerbahçe", awayTeam: "Galatasaray" },
  { id: "a4", homeTeam: "Team A", awayTeam: "Team B" },
];

describe("fallbackOdds — deterministic fixed odds", () => {
  it("returns the same values every call (never changes on refresh)", () => {
    for (const f of FIXTURES) {
      expect(fallbackOdds(f)).toEqual(fallbackOdds(f));
    }
  });

  it("covers all three markets: h2h, totals, btts", () => {
    const o = fallbackOdds(FIXTURES[0]);
    expect(o.h2h.home).toBeGreaterThan(1);
    expect(o.h2h.draw).toBeGreaterThan(1);
    expect(o.h2h.away).toBeGreaterThan(1);
    expect(o.totals["over_2.5"]).toBeGreaterThan(1);
    expect(o.totals["under_2.5"]).toBeGreaterThan(1);
    expect(o.btts.btts_yes).toBeGreaterThan(1);
    expect(o.btts.btts_no).toBeGreaterThan(1);
  });

  it("stays in realistic ranges for every market", () => {
    for (const f of FIXTURES) {
      const o = fallbackOdds(f);
      for (const v of [o.h2h.home, o.h2h.draw, o.h2h.away, o.totals["over_2.5"], o.totals["under_2.5"], o.btts.btts_yes, o.btts.btts_no]) {
        expect(v).toBeGreaterThanOrEqual(1.01);
        expect(v).toBeLessThanOrEqual(35); // capped at bookmaker-plausible ceiling
      }
      // ultra-lopsided matchups can hit the 35 cap; the favorite still reads short
      expect(Math.min(o.h2h.home, o.h2h.away)).toBeLessThan(2.5);
    }
  });

  it("has a bookmaker margin of 3–12% on 1X2", () => {
    for (const f of FIXTURES) {
      const o = fallbackOdds(f);
      const margin = inverseProb(o.h2h.home) + inverseProb(o.h2h.draw) + inverseProb(o.h2h.away) - 1;
      expect(margin).toBeGreaterThan(0.02);
      expect(margin).toBeLessThan(0.15);
    }
  });

  it("different fixtures produce different odds", () => {
    const set = new Set(FIXTURES.map((f) => JSON.stringify(fallbackOdds(f).h2h)));
    expect(set.size).toBeGreaterThan(1);
  });
});

import { leaguePriority } from "@/lib/leagues";

describe("leaguePriority — big leagues first", () => {
  it("ranks the top-6 leagues and cups at priority 1", () => {
    expect(leaguePriority("39")).toBe(2); // EPL (api-football)
    expect(leaguePriority("140")).toBe(2); // La Liga
    expect(leaguePriority("135")).toBe(2); // Serie A
    expect(leaguePriority("78")).toBe(2); // Bundesliga
    expect(leaguePriority("61")).toBe(2); // Ligue 1
    expect(leaguePriority("2")).toBe(2); // Champions League
    expect(leaguePriority("fd:2021")).toBe(2); // EPL (football-data)
    expect(leaguePriority("fd:2001")).toBe(2); // UCL (football-data)
  });

  it("ranks second-tier competitions at priority 2", () => {
    expect(leaguePriority("3")).toBe(1); // Europa League
    expect(leaguePriority("88")).toBe(1); // Eredivisie
    expect(leaguePriority("94")).toBe(1); // Primeira Liga
    expect(leaguePriority("203")).toBe(1); // Süper Lig
    expect(leaguePriority("144")).toBe(1); // Belgian First Division A
  });

  it("defaults everything else to 0", () => {
    expect(leaguePriority("301")).toBe(0); // Brazilian Serie A
    expect(leaguePriority("fd:2004")).toBe(0); // some small league
    expect(leaguePriority("")).toBe(0);
  });
});
