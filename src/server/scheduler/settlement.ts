import type { Server } from "socket.io";
import { runSettlementSweep } from "@/lib/bets/settle";

export async function runSettlement(io?: Server): Promise<void> {
  const notifications = await runSettlementSweep();
  for (const n of notifications) {
    io?.to(`user:${n.userId}`).emit("bet:settled", {
      betId: n.betId,
      status: n.status,
      payout: n.payout,
      pointBalance: n.pointBalance,
    });
  }
  if (notifications.length > 0) {
    console.log(`[settlement] settled ${notifications.length} bet(s)`);
  }
}
