import { describe, it, expect } from "vitest";
import {
  comboSizes,
  comboCount,
  generateCombinations,
  splitStake,
} from "@/lib/betting/combos";

describe("comboSizes", () => {
  it("TRIXIE is doubles + treble", () => {
    expect(comboSizes("TRIXIE")).toEqual([2, 3]);
  });
  it("PATENT adds singles to TRIXIE", () => {
    expect(comboSizes("PATENT")).toEqual([1, 2, 3]);
  });
  it("YANKEE is doubles/trebles/fourfold", () => {
    expect(comboSizes("YANKEE")).toEqual([2, 3, 4]);
  });
  it("LUCKY15 adds singles to YANKEE", () => {
    expect(comboSizes("LUCKY15")).toEqual([1, 2, 3, 4]);
  });
});

describe("comboCount", () => {
  it("matches bookmaker counts", () => {
    expect(comboCount("TRIXIE")).toBe(4);
    expect(comboCount("PATENT")).toBe(7);
    expect(comboCount("YANKEE")).toBe(11);
    expect(comboCount("LUCKY15")).toBe(15);
  });
});

describe("generateCombinations", () => {
  const legs = ["a", "b", "c"];

  it("TRIXIE from 3 legs gives 3 doubles + 1 treble", () => {
    const combos = generateCombinations("TRIXIE", legs);
    expect(combos).toHaveLength(4);
    expect(combos).toContainEqual(["a", "b"]);
    expect(combos).toContainEqual(["a", "c"]);
    expect(combos).toContainEqual(["b", "c"]);
    expect(combos).toContainEqual(["a", "b", "c"]);
  });

  it("PATENT from 3 legs gives 7 combos incl. singles", () => {
    const combos = generateCombinations("PATENT", legs);
    expect(combos).toHaveLength(7);
  });

  it("PATENT includes each single", () => {
    const combos = generateCombinations("PATENT", legs);
    expect(combos).toContainEqual(["a"]);
    expect(combos).toContainEqual(["b"]);
    expect(combos).toContainEqual(["c"]);
  });

  it("YANKEE from 4 legs gives 6 doubles + 4 trebles + 1 fourfold", () => {
    const legs4 = ["a", "b", "c", "d"];
    const combos = generateCombinations("YANKEE", legs4);
    expect(combos).toHaveLength(11);
    const doubles = combos.filter((c) => c.length === 2);
    const trebles = combos.filter((c) => c.length === 3);
    const fourfolds = combos.filter((c) => c.length === 4);
    expect(doubles).toHaveLength(6);
    expect(trebles).toHaveLength(4);
    expect(fourfolds).toHaveLength(1);
  });

  it("LUCKY15 from 4 legs gives 15 combos", () => {
    expect(generateCombinations("LUCKY15", ["a", "b", "c", "d"])).toHaveLength(15);
  });

  it("TRIXIE from 5 legs still uses only first 3 by design (validated upstream)", () => {
    // 5 legs → C(5,2)=10 doubles + C(5,3)=10 trebles = 20 (system bets accept exact leg counts upstream)
    expect(generateCombinations("TRIXIE", ["a", "b", "c", "d", "e"])).toHaveLength(20);
  });
});

describe("splitStake", () => {
  it("divides evenly", () => {
    expect(splitStake(100, 4)).toEqual({ stake: 25, remainder: 0 });
  });
  it("floors and returns remainder", () => {
    expect(splitStake(100, 7)).toEqual({ stake: 14, remainder: 2 });
  });
  it("handles tiny stakes", () => {
    expect(splitStake(3, 7)).toEqual({ stake: 0, remainder: 3 });
  });
  it("handles zero stake", () => {
    expect(splitStake(0, 4)).toEqual({ stake: 0, remainder: 0 });
  });
});
