import { describe, it, expect, vi } from "vitest";
import { KeyPool, AllKeysExhaustedError } from "@/server/adapters/key-pool";

function fakeClock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe("KeyPool", () => {
  it("round-robins healthy keys", () => {
    const pool = new KeyPool(["a", "b", "c"]);
    expect([pool.next(), pool.next(), pool.next(), pool.next()]).toEqual([
      "a",
      "b",
      "c",
      "a",
    ]);
  });

  it("single key always returns it", () => {
    const pool = new KeyPool(["only"]);
    expect(pool.next()).toBe("only");
    expect(pool.next()).toBe("only");
  });

  it("skips keys cooling down after quota failure", () => {
    const clock = fakeClock();
    const pool = new KeyPool(["a", "b"], { now: clock.now });
    pool.reportFailure("a", "quota");
    expect(pool.next()).toBe("b");
    expect(pool.next()).toBe("b");
  });

  it("key returns after cooldown elapses", () => {
    const clock = fakeClock();
    const pool = new KeyPool(["a", "b"], { now: clock.now });
    pool.reportFailure("a", "quota");
    clock.advance(60 * 60 * 1000 + 1);
    expect(pool.next()).toBe("a");
  });

  it("quota cooldown honors reported reset time", () => {
    const clock = fakeClock();
    const pool = new KeyPool(["a", "b"], { now: clock.now });
    pool.reportRemaining("a", 0, clock.now() + 30 * 60 * 1000);
    expect(pool.next()).toBe("b");
    clock.advance(30 * 60 * 1000 + 1);
    expect(pool.next()).toBe("a");
  });

  it("auth failure disables a key permanently", () => {
    const clock = fakeClock();
    const pool = new KeyPool(["a", "b"], { now: clock.now });
    pool.reportFailure("a", "auth");
    clock.advance(24 * 60 * 60 * 1000);
    expect(pool.next()).toBe("b");
  });

  it("throws AllKeysExhaustedError when every key is cooling down", () => {
    const clock = fakeClock();
    const pool = new KeyPool(["a"], { now: clock.now });
    pool.reportFailure("a", "quota");
    expect(() => pool.next()).toThrow(AllKeysExhaustedError);
  });

  it("empty pool throws immediately", () => {
    const pool = new KeyPool([]);
    expect(() => pool.next()).toThrow(AllKeysExhaustedError);
  });

  it("network failures do not remove keys (transient)", () => {
    const clock = fakeClock();
    const pool = new KeyPool(["a"], { now: clock.now });
    pool.reportFailure("a", "network");
    expect(pool.next()).toBe("a");
  });

  it("tracks remaining per key", () => {
    const pool = new KeyPool(["a", "b"]);
    pool.reportRemaining("a", 42, Date.now() + 1000);
    expect(pool.remaining("a")).toBe(42);
    expect(pool.remaining("b")).toBeUndefined();
  });
});
