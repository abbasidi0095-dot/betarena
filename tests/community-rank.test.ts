import { describe, it, expect } from "vitest";
import { rankBettors } from "@/lib/community/rank";

const rows = [
  { userId: "a", username: "A", isBot: false, won: true },
  { userId: "a", username: "A", isBot: false, won: false },
  { userId: "a", username: "A", isBot: false, won: true },
  { userId: "b", username: "B", isBot: false, won: true },
  { userId: "c", username: "C", isBot: true, won: true },
  { userId: "c", username: "C", isBot: true, won: false },
  { userId: "c", username: "C", isBot: true, won: true },
  { userId: "d", username: "D", isBot: false, won: false },
];

describe("rankBettors", () => {
  it("ranks by win rate with minimum 3 settled bets", () => {
    const ranked = rankBettors(rows);
    expect(ranked.map((r) => r.username)).toEqual(["A", "C"]);
    expect(ranked[0]).toMatchObject({ settled: 3, won: 2, winRate: 67 });
  });

  it("includes bots in the ranking", () => {
    expect(rankBettors(rows).some((r) => r.isBot)).toBe(true);
  });

  it("excludes bettors below the minimum settled threshold", () => {
    const ranked = rankBettors(rows, 3);
    expect(ranked.every((r) => r.settled >= 3)).toBe(true);
  });

  it("returns empty for no rows", () => {
    expect(rankBettors([])).toEqual([]);
  });
});
