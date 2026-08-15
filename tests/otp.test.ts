import { describe, it, expect } from "vitest";
import { generateOtp, hashOtp, checkOtp, OTP_MAX_ATTEMPTS } from "@/lib/otp";

describe("generateOtp", () => {
  it("produces 6-digit codes", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashOtp", () => {
  it("never stores the raw code", () => {
    const h = hashOtp("123456");
    expect(h).not.toContain("123456");
    expect(h).toHaveLength(64);
  });
  it("is deterministic", () => {
    expect(hashOtp("123456")).toBe(hashOtp("123456"));
  });
});

describe("checkOtp", () => {
  const now = new Date("2026-08-15T12:00:00Z");

  it("accepts a correct code within expiry", () => {
    const r = checkOtp(hashOtp("123456"), new Date(now.getTime() + 60_000), 0, now, "123456");
    expect(r).toEqual({ valid: true, expired: false, locked: false });
  });

  it("rejects a wrong code", () => {
    const r = checkOtp(hashOtp("123456"), new Date(now.getTime() + 60_000), 0, now, "654321");
    expect(r.valid).toBe(false);
    expect(r.locked).toBe(false);
  });

  it("flags expired codes even when the code is right", () => {
    const r = checkOtp(hashOtp("123456"), new Date(now.getTime() - 1000), 0, now, "123456");
    expect(r).toEqual({ valid: false, expired: true, locked: false });
  });

  it("locks after max attempts", () => {
    const r = checkOtp(hashOtp("123456"), new Date(now.getTime() + 60_000), OTP_MAX_ATTEMPTS, now, "123456");
    expect(r).toEqual({ valid: false, expired: false, locked: true });
  });

  it("lock takes precedence over a correct code", () => {
    const r = checkOtp(hashOtp("123456"), new Date(now.getTime() + 60_000), 5, now, "123456");
    expect(r.locked).toBe(true);
    expect(r.valid).toBe(false);
  });
});
