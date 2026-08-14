import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export const COOKIE_NAME = "betarena_token";
const THIRTY_DAYS = "30d";

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 8) throw new Error("JWT_SECRET missing or too short");
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(THIRTY_DAYS)
    .sign(secret());
}

export async function verifyToken(
  token: string,
): Promise<{ id: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;
    return { id: payload.sub };
  } catch {
    return null;
  }
}

/** Read the session user from the request cookie (API route context). */
export async function getSessionUser(): Promise<{ id: string } | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
