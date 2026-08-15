import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkOtp, OTP_MAX_ATTEMPTS } from "@/lib/otp";
import { setSessionCookie } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    return jsonError("VALIDATION", "Enter the 6-digit code", 422);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isBot) {
    return jsonError("INVALID", "Invalid verification request", 400);
  }
  if (user.emailVerifiedAt) {
    return jsonError("ALREADY_VERIFIED", "Email already verified", 400);
  }

  const otp = await prisma.otp.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    return jsonError("EXPIRED", "Code expired — request a new one", 400);
  }

  const result = checkOtp(otp.codeHash, otp.expiresAt, otp.attempts, new Date(), code);
  if (result.locked) {
    return jsonError("LOCKED", "Too many attempts — request a new code", 429);
  }
  if (!result.valid) {
    await prisma.otp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = OTP_MAX_ATTEMPTS - otp.attempts - 1;
    return jsonError(
      "INVALID_CODE",
      remaining > 0 ? `Wrong code — ${remaining} attempt${remaining === 1 ? "" : "s"} left` : "Too many attempts — request a new code",
      remaining > 0 ? 400 : 429,
    );
  }
  if (result.expired) {
    await prisma.otp.delete({ where: { id: otp.id } });
    return jsonError("EXPIRED", "Code expired — request a new one", 400);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }),
    prisma.otp.deleteMany({ where: { userId: user.id } }),
  ]);

  const res = NextResponse.json({
    user: { id: user.id, username: user.username, pointBalance: user.pointBalance },
  });
  await setSessionCookie(res, user.id, req);
  return res;
}
