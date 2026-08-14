import { prisma } from "@/lib/db";
import { resolveLeg } from "@/lib/betting/settle";
import { settleCombos, type LegStatus } from "@/lib/betting/payout";

export interface SettlementNotification {
  userId: string;
  betId: string;
  status: string;
  payout: number;
  pointBalance: number;
}

/**
 * Sweep all fixtures that are FINISHED and settle any OPEN legs against them.
 * Idempotent: legs carry settledAt and are selected by status OPEN only.
 * Returns notifications for socket emission.
 */
export async function runSettlementSweep(): Promise<SettlementNotification[]> {
  const notifications: SettlementNotification[] = [];

  const fixturesWithOpenLegs = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      legs: { some: { status: "OPEN" } },
    },
    select: { id: true, homeScore: true, awayScore: true },
  });

  for (const fixture of fixturesWithOpenLegs) {
    const openLegs = await prisma.betLeg.findMany({
      where: { fixtureId: fixture.id, status: "OPEN" },
      include: { bet: true },
    });

    for (const leg of openLegs) {
      // A market that vanished (shouldn't normally happen) resolves VOID
      const outcome = resolveLeg(
        { marketKey: leg.marketKey as "h2h" | "totals" | "btts", selectionKey: leg.selectionKey },
        { home: fixture.homeScore, away: fixture.awayScore },
      );
      await prisma.betLeg.update({
        where: { id: leg.id },
        data: { status: outcome, settledAt: new Date() },
      });
    }
  }

  // Now settle bets whose legs are all resolved
  const readyBets = await prisma.bet.findMany({
    where: {
      status: "OPEN",
      legs: { none: { status: "OPEN" } },
    },
    include: { legs: true, combinations: true },
  });

  for (const bet of readyBets) {
    const legStatus = Object.fromEntries(
      bet.legs.map((l) => [l.id, l.status as LegStatus]),
    ) as Record<string, LegStatus>;
    const legOdds = Object.fromEntries(bet.legs.map((l) => [l.id, l.oddsLocked.toNumber()]));

    let payout = 0;
    let status: string;

    if (bet.type === "SINGLE") {
      const leg = bet.legs[0];
      if (leg.status === "WON") {
        payout = Math.floor(bet.stakeTotal * leg.oddsLocked.toNumber());
        status = "WON";
      } else if (leg.status === "VOID") {
        payout = bet.stakeTotal;
        status = "VOID";
      } else {
        payout = 0;
        status = "LOST";
      }
    } else if (bet.type === "ACCA") {
      const anyLost = bet.legs.some((l) => l.status === "LOST");
      const allVoid = bet.legs.every((l) => l.status === "VOID");
      if (anyLost) {
        payout = 0;
        status = "LOST";
      } else if (allVoid) {
        payout = bet.stakeTotal;
        status = "VOID";
      } else {
        const product = bet.legs.reduce(
          (acc, l) => acc * (l.status === "VOID" ? 1 : l.oddsLocked.toNumber()),
          1,
        );
        payout = Math.floor(bet.stakeTotal * product);
        status = "WON";
      }
    } else {
      const result = settleCombos(
        bet.combinations.map((c) => ({ legIds: c.legIds as string[], stake: c.stake })),
        legStatus,
        legOdds,
      );
      payout = result.payout;
      status = result.status;

      // Persist per-combination outcomes
      for (const combo of bet.combinations) {
        const ids = combo.legIds as string[];
        const anyLost = ids.some((id) => legStatus[id] === "LOST");
        const allVoid = ids.every((id) => legStatus[id] === "VOID");
        let comboStatus: string;
        let comboPayout = 0;
        if (anyLost) {
          comboStatus = "LOST";
        } else if (allVoid) {
          comboStatus = "VOID";
          comboPayout = combo.stake;
        } else {
          comboStatus = "WON";
          const product = ids.reduce(
            (acc, id) => acc * (legStatus[id] === "VOID" ? 1 : legOdds[id]),
            1,
          );
          comboPayout = Math.floor(combo.stake * product);
        }
        await prisma.betCombination.update({
          where: { id: combo.id },
          data: { status: comboStatus, payout: comboPayout },
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.bet.update({
        where: { id: bet.id },
        data: { status, payout, settledAt: new Date() },
      });
      const user = await tx.user.update({
        where: { id: bet.userId },
        data: {
          pointBalance: { increment: payout },
          totalWon: { increment: payout },
          betsWon: { increment: payout > 0 && status !== "VOID" ? 1 : 0 },
          betsLost: { increment: payout === 0 && status !== "VOID" ? 1 : 0 },
        },
      });

      notifications.push({
        userId: bet.userId,
        betId: bet.id,
        status,
        payout,
        pointBalance: user.pointBalance,
      });
    });
  }

  return notifications;
}
