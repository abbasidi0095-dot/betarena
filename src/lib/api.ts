import { NextResponse } from "next/server";

export function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export const unauthorized = () => jsonError("UNAUTHORIZED", "Please log in", 401);
export const badRequest = (message: string) =>
  jsonError("BAD_REQUEST", message, 400);
export const unprocessable = (message: string) =>
  jsonError("UNPROCESSABLE", message, 422);
