import { describe, it, expect } from "vitest";
import { resolveLeg, type LegPick } from "@/lib/betting/settle";

const h2h = (selectionKey: string): LegPick => ({
  marketKey: "h2h",
  selectionKey,
});
const totals = (selectionKey: string): LegPick => ({
  marketKey: "totals",
  selectionKey,
});
const btts = (selectionKey: string): LegPick => ({
  marketKey: "btts",
  selectionKey,
});

describe("resolveLeg — h2h", () => {
  it.each([
    ["home", { home: 2, away: 1 }, "WON"],
    ["home", { home: 1, away: 1 }, "LOST"],
    ["home", { home: 0, away: 3 }, "LOST"],
    ["draw", { home: 0, away: 0 }, "WON"],
    ["draw", { home: 2, away: 2 }, "WON"],
    ["draw", { home: 1, away: 0 }, "LOST"],
    ["away", { home: 0, away: 1 }, "WON"],
    ["away", { home: 2, away: 2 }, "LOST"],
    ["away", { home: 3, away: 0 }, "LOST"],
  ])("%s on %j → %s", (sel, score, expected) => {
    expect(resolveLeg(h2h(sel), score)).toBe(expected);
  });
});

describe("resolveLeg — totals (2.5 line)", () => {
  it.each([
    ["over_2.5", { home: 2, away: 1 }, "WON"],
    ["over_2.5", { home: 3, away: 0 }, "WON"],
    ["over_2.5", { home: 1, away: 1 }, "LOST"],
    ["over_2.5", { home: 2, away: 0 }, "LOST"],
    ["under_2.5", { home: 0, away: 0 }, "WON"],
    ["under_2.5", { home: 1, away: 1 }, "WON"],
    ["under_2.5", { home: 2, away: 1 }, "LOST"],
    ["under_2.5", { home: 0, away: 3 }, "LOST"],
  ])("%s on %j → %s", (sel, score, expected) => {
    expect(resolveLeg(totals(sel), score)).toBe(expected);
  });
});

describe("resolveLeg — btts", () => {
  it.each([
    ["btts_yes", { home: 1, away: 1 }, "WON"],
    ["btts_yes", { home: 2, away: 3 }, "WON"],
    ["btts_yes", { home: 0, away: 2 }, "LOST"],
    ["btts_yes", { home: 3, away: 0 }, "LOST"],
    ["btts_no", { home: 0, away: 0 }, "WON"],
    ["btts_no", { home: 2, away: 0 }, "WON"],
    ["btts_no", { home: 1, away: 1 }, "LOST"],
  ])("%s on %j → %s", (sel, score, expected) => {
    expect(resolveLeg(btts(sel), score)).toBe(expected);
  });
});

describe("resolveLeg — defensive cases", () => {
  it("unknown selectionKey → VOID (caller treats as unresolved/void)", () => {
    expect(resolveLeg(h2h("nope"), { home: 1, away: 0 })).toBe("VOID");
    expect(resolveLeg(totals("over_1.5"), { home: 1, away: 0 })).toBe("VOID");
  });
});
