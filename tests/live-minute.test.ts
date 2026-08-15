import { describe, it, expect } from "vitest";
import { liveMinuteFromElapsed, parseFootballDataMinute } from "@/lib/live/minute";

const ko = new Date("2026-08-15T10:00:00Z");
const at = (min: number) => new Date(ko.getTime() + min * 60_000);

describe("liveMinuteFromElapsed", () => {
  it("returns 0 before kickoff", () => {
    expect(liveMinuteFromElapsed(ko, new Date(ko.getTime() - 5 * 60_000))).toBe(0);
  });

  it("tracks the first half minute by minute", () => {
    expect(liveMinuteFromElapsed(ko, at(1))).toBe(1);
    expect(liveMinuteFromElapsed(ko, at(30))).toBe(30);
    expect(liveMinuteFromElapsed(ko, at(45))).toBe(45);
  });

  it("holds at 45 during the halftime break", () => {
    expect(liveMinuteFromElapsed(ko, at(46))).toBe(45);
    expect(liveMinuteFromElapsed(ko, at(59))).toBe(45);
  });

  it("resumes the second half after the break", () => {
    expect(liveMinuteFromElapsed(ko, at(61))).toBe(46);
    expect(liveMinuteFromElapsed(ko, at(75))).toBe(60);
  });

  it("caps at 90", () => {
    expect(liveMinuteFromElapsed(ko, at(90))).toBe(75);
    expect(liveMinuteFromElapsed(ko, at(105))).toBe(90);
    expect(liveMinuteFromElapsed(ko, at(200))).toBe(90);
  });
});

describe("parseFootballDataMinute", () => {
  it("accepts plain numbers", () => {
    expect(parseFootballDataMinute(17)).toBe(17);
    expect(parseFootballDataMinute(90)).toBe(90);
  });

  it("parses plain string minutes", () => {
    expect(parseFootballDataMinute("17")).toBe(17);
    expect(parseFootballDataMinute("90")).toBe(90);
  });

  it("parses added-time strings into total minutes", () => {
    expect(parseFootballDataMinute("90+2")).toBe(92);
    expect(parseFootballDataMinute("45+3")).toBe(48);
    expect(parseFootballDataMinute(" 90 + 5 ")).toBe(95);
  });

  it("returns null for unknown values", () => {
    expect(parseFootballDataMinute(null)).toBeNull();
    expect(parseFootballDataMinute(undefined)).toBeNull();
    expect(parseFootballDataMinute("HT")).toBeNull();
    expect(parseFootballDataMinute("")).toBeNull();
  });
});
