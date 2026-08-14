import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { hashPassword, createToken, COOKIE_NAME } from "@/lib/auth";
import { jsonError } from "@/lib/api";


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
