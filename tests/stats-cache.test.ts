import { describe, it, expect, beforeEach, vi } from "vitest";
import { TTLCache } from "@/lib/stats/memo";

describe("TTLCache", () => {
  beforeEach(() => vi.useFakeTimers());

  it("returns undefined for a missing key", () => {
    const c = new TTLCache<number>();
    expect(c.get("nope")).toBeUndefined();
  });

  it("returns the value before TTL expiry", () => {
    const c = new TTLCache<string>(15 * 60 * 1000);
    c.set("a", "hello");
    vi.advanceTimersByTime(15 * 60 * 1000 - 1);
    expect(c.get("a")).toBe("hello");
  });

  it("expires after TTL", () => {
    const c = new TTLCache<string>(15 * 60 * 1000);
    c.set("a", "hello");
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(c.get("a")).toBeUndefined();
  });

  it("supports per-set TTL override", () => {
    const c = new TTLCache<string>(15 * 60 * 1000);
    c.set("a", "hello", 1000);
    vi.advanceTimersByTime(1001);
    expect(c.get("a")).toBeUndefined();
  });
});
