import { describe, it, expect } from "vitest";
import { buildForm, computeSummary } from "@/lib/stats/fixture-stats";

const mk = (home: string, away: string, hs: number, as_: number, daysAgo: number) => ({
  homeTeam: home,
  awayTeam: away,
  homeScore: hs,
  awayScore: as_,
  kickoff: new Date(Date.now() - daysAgo * 86_400_000),
});

describe("buildForm", () => {
  it("maps recent fixtures to W/D/L for the given team", () => {
    const rows = [
      mk("Real Madrid", "Barcelona", 2, 0, 1),
      mk("Sevilla", "Real Madrid", 1, 1, 2),
      mk("Real Madrid", "Getafe", 0, 1, 3),
    ];
    const form = buildForm(rows, "Real Madrid");
    expect(form.map((f) => f.result)).toEqual(["W", "D", "L"]);
    expect(form[0].opponent).toBe("Barcelona");
    expect(form[0].score).toBe("2 - 0");
  });

  it("returns an empty array for an unknown team", () => {
    expect(buildForm([], "Nobody")).toEqual([]);
  });
});

describe("computeSummary", () => {
  it("computes win/draw/loss percentages from forms", () => {
    const home = [{ result: "W" }, { result: "W" }, { result: "D" }, { result: "L" }, { result: "W" }] as { result: "W" | "D" | "L" }[];
    const away = [{ result: "L" }, { result: "L" }, { result: "D" }, { result: "W" }, { result: "L" }] as { result: "W" | "D" | "L" }[];
    const s = computeSummary(home as any, away as any, []);
    expect(s.homeWinPct).toBe(60);
    expect(s.drawPct).toBe(20);
    expect(s.awayWinPct).toBe(20);
  });

  it("handles empty forms with zeros", () => {
    const s = computeSummary([], [], []);
    expect(s).toEqual({ homeWinPct: 0, drawPct: 0, awayWinPct: 0 });
  });
});
