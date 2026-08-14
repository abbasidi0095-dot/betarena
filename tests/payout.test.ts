import { describe, it, expect } from "vitest";
import { accaOdds, settleCombos } from "@/lib/betting/payout";

describe("accaOdds", () => {
  it("multiplies odds", () => {
    expect(accaOdds([2, 3, 1.5])).toBe(9);
  });
  it("treats VOID as 1.0", () => {
    expect(accaOdds([2, "VOID", 3])).toBe(6);
    expect(accaOdds(["VOID", "VOID"])).toBe(1);
  });
  it("returns 1 for empty", () => {
    expect(accaOdds([])).toBe(1);
  });
});

describe("settleCombos", () => {
  const odds = { a: 2, b: 3, c: 1.5, d: 4 };

  it("all legs won → every combo wins, payout is sum of floor(stake × product)", () => {
    const combos = [
      { legIds: ["a", "b"], stake: 10 },
      { legIds: ["c"], stake: 10 },
    ];
    const r = settleCombos(combos, { a: "WON", b: "WON", c: "WON" }, odds);
    expect(r.payout).toBe(60 + 15);
    expect(r.status).toBe("WON");
  });

  it("any leg LOST kills only combos containing it → PARTIAL", () => {
    const combos = [
      { legIds: ["a", "b"], stake: 10 },
      { legIds: ["a", "c"], stake: 10 },
    ];
    const r = settleCombos(combos, { a: "WON", b: "LOST", c: "WON" }, odds);
    expect(r.payout).toBe(30);
    expect(r.status).toBe("PARTIAL");
  });

  it("all combos lose → LOST, zero payout", () => {
    const combos = [{ legIds: ["a", "b"], stake: 10 }];
    const r = settleCombos(combos, { a: "WON", b: "LOST" }, odds);
    expect(r.payout).toBe(0);
    expect(r.status).toBe("LOST");
  });

  it("VOID legs count as odds 1.0", () => {
    const combos = [{ legIds: ["a", "b"], stake: 10 }];
    const r = settleCombos(combos, { a: "WON", b: "VOID" }, odds);
    expect(r.payout).toBe(20);
    expect(r.status).toBe("WON");
  });

  it("all legs VOID → stake refunded, status VOID", () => {
    const combos = [
      { legIds: ["a", "b"], stake: 10 },
      { legIds: ["c"], stake: 10 },
    ];
    const r = settleCombos(combos, { a: "VOID", b: "VOID", c: "VOID" }, odds);
    expect(r.payout).toBe(20);
    expect(r.status).toBe("VOID");
  });

  it("floors fractional payouts per combo", () => {
    const combos = [{ legIds: ["a", "c"], stake: 7 }];
    const r = settleCombos(combos, { a: "WON", c: "WON" }, odds);
    expect(r.payout).toBe(Math.floor(7 * 3));
  });

  it("OPEN legs are not settled (treated as not-yet-decided → combo stays uncounted)", () => {
    const combos = [
      { legIds: ["a", "b"], stake: 10 },
      { legIds: ["c"], stake: 10 },
    ];
    const r = settleCombos(combos, { a: "WON", b: "OPEN", c: "WON" }, odds);
    expect(r.payout).toBe(15);
    expect(r.status).toBe("PARTIAL");
  });
});
