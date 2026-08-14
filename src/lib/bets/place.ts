import { prisma } from "@/lib/db";
import type { PlaceBetInput } from "@/lib/validation";
import {
  comboCount,
  generateCombinations,
  splitStake,
  type SystemType,
} from "@/lib/betting/combos";

export interface PlacedBetSummary {
  betId: string;
  type: string;
  systemType?: string | null;
  stake: number;
  potentialReturn: number;
}

export class PlacementError extends Error {
  constructor(
    message: string,
    public code: string = "UNPROCESSABLE",
  ) {
    super(message);
  }
}

const SELECTION_LABELS: Record<string, string> = {
  home: "{home} to win",
  draw: "Draw",
  away: "{away} to win",
  "over_2.5": "Over 2.5 goals",
  "under_2.5": "Under 2.5 goals",
  btts_yes: "Both teams to score — Yes",
  btts_no: "Both teams to score — No",
};

export function selectionLabel(
  selectionKey: string,
  fixture: { homeTeam: string; awayTeam: string },
): string {
  const template = SELECTION_LABELS[selectionKey] ?? selectionKey;
  return template.replace("{home}", fixture.homeTeam).replace("{away}", fixture.awayTeam);
}

const SYSTEM_LEG_REQUIREMENTS: Record<SystemType, number> = {
  TRIXIE: 3,
  PATENT: 3,
  YANKEE: 4,
  LUCKY15: 4,
};

interface ResolvedSelection {
  fixtureId: string;
  marketKey: string;
  selectionKey: string;
  selectionName: string;
  fixtureLabel: string;
  odds: number;
}

async function resolveSelections(
  selections: PlaceBetInput["selections"],
): Promise<ResolvedSelection[]> {
  const out: ResolvedSelection[] = [];
  const seen = new Set<string>();

  for (const sel of selections) {
    const dedupeKey = `${sel.fixtureId}:${sel.marketKey}:${sel.selectionKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const fixture = await prisma.fixture.findUnique({
      where: { id: sel.fixtureId },
    });
    if (!fixture) throw new PlacementError("Match no longer exists");
    if (fixture.status === "FINISHED")
      throw new PlacementError(`${fixture.homeTeam} vs ${fixture.awayTeam} has finished`);

    const market = await prisma.market.findUnique({
      where: { fixtureId_key: { fixtureId: fixture.id, key: sel.marketKey } },
    });
    if (!market || market.status !== "OPEN")
      throw new PlacementError("Market unavailable for this match");

    const odds = await prisma.odds.findUnique({
      where: { marketId_selectionKey: { marketId: market.id, selectionKey: sel.selectionKey } },
    });
    if (!odds) throw new PlacementError("Selection unavailable for this match");

    out.push({
      fixtureId: fixture.id,
      marketKey: sel.marketKey,
      selectionKey: sel.selectionKey,
      selectionName: selectionLabel(sel.selectionKey, fixture),
      fixtureLabel: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      odds: odds.value.toNumber(),
    });
  }

  if (out.length === 0) throw new PlacementError("No valid selections");
  return out;
}

/**
 * Place bets transactionally. For SINGLE, the stake applies per selection
 * (N separate bets, N × stake deducted). Returns created bet summaries.
 */
export async function placeBets(
  userId: string,
  input: PlaceBetInput,
): Promise<{ bets: PlacedBetSummary[]; pointBalance: number; refunded: number }> {
  if (input.type === "SYSTEM" && input.systemType) {
    const required = SYSTEM_LEG_REQUIREMENTS[input.systemType];
    if (input.selections.length !== required) {
      throw new PlacementError(
        `${input.systemType} requires exactly ${required} selections`,
      );
    }
  }
  if (input.type === "ACCA" && input.selections.length < 2) {
    throw new PlacementError("Accumulators need at least 2 selections");
  }

  const selections = await resolveSelections(input.selections);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new PlacementError("Account not found", "UNAUTHORIZED");

  const totalCost =
    input.type === "SINGLE" ? input.stake * selections.length : input.stake;
  if (user.pointBalance < totalCost) {
    throw new PlacementError("Insufficient BetPoints balance");
  }

  return await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        pointBalance: { decrement: totalCost },
        totalStaked: { increment: totalCost },
      },
    });

    const created: PlacedBetSummary[] = [];
    let refunded = 0;

    if (input.type === "SINGLE") {
      for (const sel of selections) {
        const bet = await tx.bet.create({
          data: {
            userId,
            type: "SINGLE",
            stakeTotal: input.stake,
            potentialReturn: Math.floor(input.stake * sel.odds),
            legs: {
              create: {
                fixtureId: sel.fixtureId,
                marketKey: sel.marketKey,
                selectionKey: sel.selectionKey,
                selectionName: sel.selectionName,
                oddsLocked: sel.odds,
              },
            },
          },
        });
        created.push({
          betId: bet.id,
          type: "SINGLE",
          stake: input.stake,
          potentialReturn: bet.potentialReturn.toNumber(),
        });
      }
    } else if (input.type === "ACCA") {
      const product = selections.reduce((acc, s) => acc * s.odds, 1);
      const bet = await tx.bet.create({
        data: {
          userId,
          type: "ACCA",
          stakeTotal: input.stake,
          potentialReturn: Math.floor(input.stake * product),
          legs: {
            create: selections.map((sel) => ({
              fixtureId: sel.fixtureId,
              marketKey: sel.marketKey,
              selectionKey: sel.selectionKey,
              selectionName: sel.selectionName,
              oddsLocked: sel.odds,
            })),
          },
        },
      });
      created.push({
        betId: bet.id,
        type: "ACCA",
        stake: input.stake,
        potentialReturn: bet.potentialReturn.toNumber(),
      });
    } else {
      const systemType = input.systemType as SystemType;
      const legRows: { id: string; odds: number; sel: ResolvedSelection }[] = [];

      const bet = await tx.bet.create({
        data: {
          userId,
          type: "SYSTEM",
          systemType,
          stakeTotal: input.stake,
          legs: {
            create: selections.map((sel) => ({
              fixtureId: sel.fixtureId,
              marketKey: sel.marketKey,
              selectionKey: sel.selectionKey,
              selectionName: sel.selectionName,
              oddsLocked: sel.odds,
            })),
          },
        },
      });

      const legs = await tx.betLeg.findMany({ where: { betId: bet.id } });
      // Re-associate legs to selections by (fixtureId, marketKey, selectionKey)
      for (const sel of selections) {
        const leg = legs.find(
          (l) =>
            l.fixtureId === sel.fixtureId &&
            l.marketKey === sel.marketKey &&
            l.selectionKey === sel.selectionKey,
        );
        if (leg) legRows.push({ id: leg.id, odds: sel.odds, sel });
      }

      const combos = generateCombinations(
        systemType,
        legRows.map((l) => l.id),
      );
      const { stake: perCombo, remainder } = splitStake(input.stake, comboCount(systemType));
      refunded = remainder;

      let maxPotential = 0;
      for (const legIds of combos) {
        const oddsById = new Map(legRows.map((l) => [l.id, l.odds]));
        const product = legIds.reduce((acc, id) => acc * (oddsById.get(id) ?? 1), 1);
        maxPotential += Math.floor(perCombo * product);
        await tx.betCombination.create({
          data: {
            betId: bet.id,
            legIds,
            stake: perCombo,
            oddsProduct: product,
          },
        });
      }

      await tx.bet.update({
        where: { id: bet.id },
        data: { potentialReturn: maxPotential },
      });

      created.push({
        betId: bet.id,
        type: "SYSTEM",
        systemType,
        stake: input.stake,
        potentialReturn: maxPotential,
      });
    }

    // Refund system stake remainder immediately
    let pointBalance = updatedUser.pointBalance;
    if (refunded > 0) {
      const afterRefund = await tx.user.update({
        where: { id: userId },
        data: { pointBalance: { increment: refunded } },
      });
      pointBalance = afterRefund.pointBalance;
    }

    return { bets: created, pointBalance, refunded };
  });
}
