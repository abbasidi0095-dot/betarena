import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OTP_RESEND_COOLDOWN_MS } from "@/lib/otp";
import { issueOtp } from "@/server/otp-service";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return jsonError("VALIDATION", "Email required", 422);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isBot) {
    return jsonError("INVALID", "Invalid verification request", 400);
  }
  if (user.emailVerifiedAt) {
    return jsonError("ALREADY_VERIFIED", "Email already verified", 400);
  }

  const last = await prisma.otp.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000);
    return jsonError("RATE_LIMITED", `Wait ${wait}s before requesting a new code`, 429);
  }

  await issueOtp(user.id, user.email);
  return NextResponse.json({ ok: true });
}
