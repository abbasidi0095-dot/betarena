import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { verifyPassword, createToken, COOKIE_NAME } from "@/lib/auth";
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

  const token = await createToken(user.id);
  const res = NextResponse.json({
    user: { id: user.id, username: user.username, pointBalance: user.pointBalance },
  });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
