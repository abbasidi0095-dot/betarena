import { describe, it, expect } from "vitest";
import { fallbackOdds, liveFallbackOdds } from "@/lib/betting/fallback-odds";

const fixture = { id: "fx-live-1", homeTeam: "Olympique Lyonnais", awayTeam: "RC Strasbourg" };
const base = fallbackOdds(fixture);

describe("liveFallbackOdds", () => {
  it("is deterministic for identical inputs", () => {
    const a = liveFallbackOdds(fixture, { homeScore: 1, awayScore: 0, minute: 70 });
    const b = liveFallbackOdds(fixture, { homeScore: 1, awayScore: 0, minute: 70 });
    expect(a).toEqual(b);
  });

  it("stays near pre-match odds at kickoff with no score", () => {
    const l = liveFallbackOdds(fixture, { homeScore: 0, awayScore: 0, minute: 1 });
    expect(Math.abs(l.h2h.home - base.h2h.home)).toBeLessThan(0.2);
    expect(Math.abs(l.h2h.away - base.h2h.away)).toBeLessThan(0.2);
  });

  it("shortens the leader's odds and lengthens the trailing side after a goal", () => {
    const l = liveFallbackOdds(fixture, { homeScore: 1, awayScore: 0, minute: 80 });
    expect(l.h2h.home).toBeLessThan(base.h2h.home);
    expect(l.h2h.away).toBeGreaterThan(base.h2h.away);
  });

  it("reacts to an away lead too", () => {
    const l = liveFallbackOdds(fixture, { homeScore: 0, awayScore: 1, minute: 85 });
    expect(l.h2h.away).toBeLessThan(base.h2h.away);
    expect(l.h2h.home).toBeGreaterThan(base.h2h.home);
  });

  it("makes a bigger lead a bigger favorite", () => {
    const one = liveFallbackOdds(fixture, { homeScore: 1, awayScore: 0, minute: 70 });
    const two = liveFallbackOdds(fixture, { homeScore: 2, awayScore: 0, minute: 70 });
    expect(two.h2h.home).toBeLessThan(one.h2h.home);
  });

  it("a late lead is more decisive than an early one", () => {
    const early = liveFallbackOdds(fixture, { homeScore: 1, awayScore: 0, minute: 10 });
    const late = liveFallbackOdds(fixture, { homeScore: 1, awayScore: 0, minute: 80 });
    expect(late.h2h.home).toBeLessThan(early.h2h.home);
  });

  it("a level score shortens the draw as the match nears its end", () => {
    const early = liveFallbackOdds(fixture, { homeScore: 0, awayScore: 0, minute: 10 });
    const late = liveFallbackOdds(fixture, { homeScore: 0, awayScore: 0, minute: 85 });
    expect(late.h2h.draw).toBeLessThan(early.h2h.draw);
  });

  it("goals on the board push totals toward over", () => {
    const l = liveFallbackOdds(fixture, { homeScore: 2, awayScore: 0, minute: 60 });
    expect(l.totals["over_2.5"]).toBeLessThan(base.totals["over_2.5"]);
  });

  it("elapsed scoreless time pushes totals toward under", () => {
    const l = liveFallbackOdds(fixture, { homeScore: 0, awayScore: 0, minute: 85 });
    expect(l.totals["under_2.5"]).toBeLessThan(base.totals["under_2.5"]);
  });

  it("both sides scoring makes BTTS yes shorter", () => {
    const l = liveFallbackOdds(fixture, { homeScore: 1, awayScore: 1, minute: 70 });
    expect(l.btts.btts_yes).toBeLessThan(base.btts.btts_yes);
  });

  it("a one-sided score makes BTTS no shorter", () => {
    const l = liveFallbackOdds(fixture, { homeScore: 1, awayScore: 0, minute: 70 });
    expect(l.btts.btts_no).toBeLessThan(base.btts.btts_no);
  });

  it("a tied match at the 90th minute has very short draw odds", () => {
    const l = liveFallbackOdds(fixture, { homeScore: 0, awayScore: 0, minute: 90 });
    expect(l.h2h.draw).toBeLessThan(1.6);
  });

  it("the draw tightens faster as a level game reaches its end", () => {
    const mid = liveFallbackOdds(fixture, { homeScore: 0, awayScore: 0, minute: 70 });
    const late = liveFallbackOdds(fixture, { homeScore: 0, awayScore: 0, minute: 90 });
    expect(late.h2h.draw).toBeLessThan(mid.h2h.draw);
  });

  it("a late goal makes the leader the heavy favorite", () => {
    const l = liveFallbackOdds(fixture, { homeScore: 1, awayScore: 0, minute: 80 });
    expect(l.h2h.home).toBeLessThan(1.25);
    expect(l.h2h.away).toBeGreaterThan(5);
  });

  it("a two-goal lead late in the game nearly ends it", () => {
    const l = liveFallbackOdds(fixture, { homeScore: 2, awayScore: 0, minute: 80 });
    expect(l.h2h.home).toBeLessThan(1.1);
  });

  it("keeps every value inside the bookmaker range", () => {
    for (const minute of [1, 45, 60, 80, 90]) {
      for (const h of [0, 1, 2, 3]) {
        for (const a of [0, 1, 2]) {
          const l = liveFallbackOdds(fixture, { homeScore: h, awayScore: a, minute });
          for (const v of [
            l.h2h.home, l.h2h.draw, l.h2h.away,
            l.totals["over_2.5"], l.totals["under_2.5"],
            l.btts.btts_yes, l.btts.btts_no,
          ]) {
            expect(v).toBeGreaterThanOrEqual(1.01);
            expect(v).toBeLessThanOrEqual(35);
          }
        }
      }
    }
  });
});
