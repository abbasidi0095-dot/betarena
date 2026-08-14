import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { unauthorized, badRequest } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  const { key } = await params;
  const [requesterId, addresseeId] = key.split(":");
  if (!requesterId || !addresseeId) return badRequest("Bad friendship key");
  if (addresseeId !== session.id) return badRequest("Not your request");

  const action = req.nextUrl.searchParams.get("action");
  if (action !== "accept" && action !== "decline") return badRequest("Unknown action");

  await prisma.friendship.update({
    where: { requesterId_addresseeId: { requesterId, addresseeId } },
    data: { status: action === "accept" ? "ACCEPTED" : "DECLINED" },
  });

  return NextResponse.json({ ok: true });
}
