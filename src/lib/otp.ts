import { createHash, randomInt } from "crypto";

export const OTP_LIFETIME_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/** 6-digit code, generated from a CSPRNG. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Store only a SHA-256 hash of the code — never the raw code. */
export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export interface OtpCheck {
  /** False when the code is wrong. */
  valid: boolean;
  /** True when the code was correct but the entry is expired / used up. */
  expired: boolean;
  /** True when the caller must stop trying (too many attempts). */
  locked: boolean;
}

/**
 * Pure check against a stored (hash, expiry, attempts) tuple. The route
 * applies the outcome to the DB (invalidate on success, count attempts).
 */
export function checkOtp(
  storedHash: string,
  expiresAt: Date,
  attempts: number,
  now: Date,
  submitted: string,
): OtpCheck {
  if (attempts >= OTP_MAX_ATTEMPTS) return { valid: false, expired: false, locked: true };
  if (expiresAt.getTime() < now.getTime()) return { valid: false, expired: true, locked: false };
  const valid = hashOtp(submitted) === storedHash;
  return { valid, expired: false, locked: false };
}
