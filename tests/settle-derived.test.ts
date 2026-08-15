import { describe, it, expect } from "vitest";
import { resolveLeg, type LegPick } from "@/lib/betting/settle";

const pick = (marketKey: string, selectionKey: string): LegPick =>
  ({ marketKey, selectionKey }) as LegPick;

const score = { home: 2, away: 1 };

describe("resolveLeg — double chance (dc)", () => {
  it.each([
    ["home_or_draw", { home: 2, away: 1 }, "WON"],
    ["home_or_draw", { home: 1, away: 1 }, "WON"],
    ["home_or_draw", { home: 0, away: 1 }, "LOST"],
    ["home_or_away", { home: 2, away: 1 }, "WON"],
    ["home_or_away", { home: 1, away: 1 }, "LOST"],
    ["away_or_draw", { home: 1, away: 1 }, "WON"],
    ["away_or_draw", { home: 2, away: 1 }, "LOST"],
  ])("%s on %j → %s", (sel, s, expected) => {
    expect(resolveLeg(pick("dc", sel), s)).toBe(expected);
  });
});

describe("resolveLeg — handicap", () => {
  it("home -1 wins when margin >= 2", () => {
    expect(resolveLeg(pick("handicap", "home_-1"), { home: 2, away: 0 })).toBe("WON");
  });
  it("home -1 is a push (VOID) when margin is exactly 1", () => {
    expect(resolveLeg(pick("handicap", "home_-1"), { home: 2, away: 1 })).toBe("VOID");
  });
  it("home -1 loses when margin is 0 or negative", () => {
    expect(resolveLeg(pick("handicap", "home_-1"), { home: 1, away: 1 })).toBe("LOST");
  });
  it("away +1 covers on draw or away win", () => {
    expect(resolveLeg(pick("handicap", "away_+1"), { home: 1, away: 1 })).toBe("WON");
    expect(resolveLeg(pick("handicap", "away_+1"), { home: 0, away: 2 })).toBe("WON");
    expect(resolveLeg(pick("handicap", "away_+1"), { home: 2, away: 0 })).toBe("LOST");
  });
  it("away +2 pushes when home wins by exactly 2", () => {
    expect(resolveLeg(pick("handicap", "away_+2"), { home: 2, away: 0 })).toBe("VOID");
  });
});

describe("resolveLeg — exact goals", () => {
  it("exact counts resolve on total", () => {
    expect(resolveLeg(pick("exact", "g0"), { home: 0, away: 0 })).toBe("WON");
    expect(resolveLeg(pick("exact", "g2"), { home: 2, away: 1 })).toBe("LOST");
    expect(resolveLeg(pick("exact", "g3"), score)).toBe("WON");
  });
  it("g4 covers 4+ goals", () => {
    expect(resolveLeg(pick("exact", "g4"), { home: 3, away: 1 })).toBe("WON");
    expect(resolveLeg(pick("exact", "g4"), score)).toBe("LOST");
  });
});

describe("resolveLeg — anytime scorer", () => {
  it("WON when the player scored a goal", () => {
    const events = [
      { type: "goal", minute: 12, team: "home", player: "Erling Haaland", zone: 2 },
    ];
    expect(
      resolveLeg(pick("scorer", "scorer:Man City:Erling Haaland"), score, events),
    ).toBe("WON");
  });
  it("LOST when the player did not score", () => {
    const events = [
      { type: "goal", minute: 12, team: "home", player: "Kevin De Bruyne", zone: 2 },
    ];
    expect(
      resolveLeg(pick("scorer", "scorer:Man City:Erling Haaland"), score, events),
    ).toBe("LOST");
  });
  it("LOST when no goal events exist", () => {
    expect(
      resolveLeg(pick("scorer", "scorer:Man City:Erling Haaland"), { home: 2, away: 1 }, []),
    ).toBe("LOST");
  });
});

describe("resolveLeg — unknown selection -> VOID", () => {
  it("unknown keys never settle as wins or losses", () => {
    expect(resolveLeg(pick("handicap", "zzz_-7"), score)).toBe("VOID");
    expect(resolveLeg(pick("dc", "nope"), score)).toBe("VOID");
    expect(resolveLeg(pick("exact", "g9"), score)).toBe("VOID");
  });
});
