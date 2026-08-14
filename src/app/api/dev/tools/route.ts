import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSettlementSweep } from "@/lib/bets/settle";

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
  return NextResponse.json({ settled: notifications.length, notifications });
}

/** Jitter stored odds by ±5% so the UI's green/red flash can be demoed. */
export async function PUT() {
  if (!devToolsEnabled()) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Dev tools disabled" } }, { status: 403 });
  }
  const odds = await prisma.odds.findMany({ take: 60, include: { market: true } });
  let changed = 0;
  for (const o of odds) {
    const drift = 1 + (Math.random() * 0.1 - 0.05);
    const next = Math.max(1.01, Math.round(o.value.toNumber() * drift * 100) / 100);
    if (next === o.value.toNumber()) continue;
    await prisma.odds.update({
      where: { id: o.id },
      data: { value: next, previousValue: o.value, updatedAt: new Date() },
    });
    changed++;
  }
  return NextResponse.json({ changed });
}
