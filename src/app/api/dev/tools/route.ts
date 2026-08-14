import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSettlementSweep } from "@/lib/bets/settle";
import { getIO } from "@/server/socket";

export const dynamic = "force-dynamic";

function devToolsEnabled(): boolean {
  return process.env.ALLOW_DEV_TOOLS === "1";
}

/** Force-run the settlement sweep (dev smoke tests). */
export async function POST() {
  if (!devToolsEnabled()) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Dev tools disabled" } }, { status: 403 });
  }
  const notifications = await runSettlementSweep();
  const io = getIO();
  for (const n of notifications) {
    io?.to(`user:${n.userId}`).emit("bet:settled", {
      betId: n.betId,
      status: n.status,
      payout: n.payout,
      pointBalance: n.pointBalance,
    });
  }
  return NextResponse.json({ settled: notifications.length, notifications });
}

/** Jitter stored odds by ±5% and broadcast odds:update (dev demo of flashes). */
export async function PUT() {
  if (!devToolsEnabled()) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Dev tools disabled" } }, { status: 403 });
  }
  const io = getIO();
  const odds = await prisma.odds.findMany({ take: 60, include: { market: true } });
  let changed = 0;
  for (const o of odds) {
    const drift = 1 + (Math.random() * 0.1 - 0.05);
    const prev = o.value.toNumber();
    const next = Math.max(1.01, Math.round(prev * drift * 100) / 100);
    if (next === prev) continue;
    await prisma.odds.update({
      where: { id: o.id },
      data: { value: next, previousValue: prev, updatedAt: new Date() },
    });
    changed++;
    const payload = {
      fixtureId: o.market.fixtureId,
      marketKey: o.market.key,
      selectionKey: o.selectionKey,
      value: next,
      previousValue: prev,
    };
    io?.to(`live:fixture:${o.market.fixtureId}`).emit("odds:update", payload);
    io?.to("live").emit("odds:update", payload);
  }
  return NextResponse.json({ changed });
}
