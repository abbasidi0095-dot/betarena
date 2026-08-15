import { describe, it, expect } from "vitest";
import { liveMinuteFromElapsed, liveMatchState } from "@/lib/live/minute";

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
    expect(liveMinuteFromElapsed(ko, at(105))).toBe(90);
  });

  it("shows added time once 90 minutes of play are done", () => {
    expect(liveMinuteFromElapsed(ko, at(106))).toBe(91);
    expect(liveMinuteFromElapsed(ko, at(110))).toBe(95);
    expect(liveMinuteFromElapsed(ko, at(115))).toBe(100);
  });
});

describe("liveMatchState", () => {
  it("is live in the first half", () => {
    expect(liveMatchState(ko, at(30))).toEqual({ minute: 30, finished: false });
  });

  it("is live during halftime", () => {
    expect(liveMatchState(ko, at(50))).toEqual({ minute: 45, finished: false });
  });

  it("is live in the second half and added time", () => {
    expect(liveMatchState(ko, at(80))).toEqual({ minute: 65, finished: false });
    expect(liveMatchState(ko, at(110))).toEqual({ minute: 95, finished: false });
  });

  it("is finished once far past the 90th minute", () => {
    expect(liveMatchState(ko, at(116))).toEqual({ minute: 90, finished: true });
    expect(liveMatchState(ko, at(200))).toEqual({ minute: 90, finished: true });
  });
});
