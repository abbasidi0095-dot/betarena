import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION", parsed.error.issues[0].message, 422);
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isBot || !(await verifyPassword(password, user.passwordHash))) {
    return jsonError("INVALID_CREDENTIALS", "Invalid email or password", 401);
  }

  if (!user.emailVerifiedAt) {
    // Credentials are correct, but the email was never verified — the
    // client should show the OTP step before a session is issued.
    return jsonError("EMAIL_UNVERIFIED", "Verify your email to continue", 403);
  }

  const res = NextResponse.json({
    user: { id: user.id, username: user.username, pointBalance: user.pointBalance },
  });
  await setSessionCookie(res, user.id, req);
  return res;
}
