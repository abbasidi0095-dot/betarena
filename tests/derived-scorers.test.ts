import { describe, it, expect } from "vitest";
import { deriveMarkets } from "@/lib/betting/derived-markets";

const base = { h2h: { home: 2.0, draw: 3.4, away: 3.6 }, totals: { over_2_5: 1.9, under_2_5: 1.9 }, btts: { btts_yes: 1.8, btts_no: 1.95 } };

describe("deriveMarkets scorers", () => {
  it("returns an empty scorers array when no lineups are provided", () => {
    const m = deriveMarkets(base, "Real Madrid", "Barcelona");
    expect(m.scorers).toEqual([]);
  });

  it("returns an empty scorers array when lineups have no attackers", () => {
    const m = deriveMarkets(base, "A", "B", [
      { team: "home", teamName: "A", players: [{ id: "1", name: "Keeper", pos: "GK" }] },
      { team: "away", teamName: "B", players: [{ id: "2", name: "Defender", pos: "DF" }] },
    ]);
    expect(m.scorers).toEqual([]);
  });

  it("uses real lineup player names, never generated stars", () => {
    const m = deriveMarkets(base, "Real Madrid", "Barcelona", [
      { team: "home", teamName: "Real Madrid", formation: "4-3-3", players: [
        { id: "1", name: "Vinicius Junior", pos: "LW" },
        { id: "2", name: "Courtois", pos: "GK" },
      ] },
      { team: "away", teamName: "Barcelona", formation: "4-3-3", players: [
        { id: "3", name: "Lamine Yamal", pos: "RW" },
        { id: "4", name: "ter Stegen", pos: "GK" },
      ] },
    ]);
    const names = m.scorers.map((s) => s.name);
    expect(names).toContain("Vinicius Junior");
    expect(names).toContain("Lamine Yamal");
    expect(names).not.toContain("Courtois");
    expect(names).not.toContain("ter Stegen");
    expect(m.scorers.length).toBeLessThanOrEqual(8);
  });
});
