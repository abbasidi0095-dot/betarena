import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { issueOtp } from "@/server/otp-service";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION", parsed.error.issues[0].message, 422);
  }
  const { username, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return jsonError(
      "TAKEN",
      existing.email === email ? "Email already registered" : "Username taken",
      422,
    );
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await hashPassword(password),
      pointBalance: 1000,
    },
  });

  // Email verification via OTP — no session until the code is confirmed.
  await issueOtp(user.id, user.email);
  console.log(`[auth] registered ${email} — awaiting OTP verification`);

  return NextResponse.json({
    user: { id: user.id, username: user.username, pointBalance: user.pointBalance },
    verificationPending: true,
  });
}
