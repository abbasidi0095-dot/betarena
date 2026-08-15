import { describe, it, expect, vi, afterEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    fixture: { findMany: vi.fn() },
    market: { upsert: vi.fn() },
    odds: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { backfillFallbackOdds } from "@/server/scheduler/odds";
import { fallbackOdds } from "@/lib/betting/fallback-odds";

afterEach(() => vi.clearAllMocks());

describe("backfillFallbackOdds", () => {
  it("creates 3 markets x 2-3 selections for fixtures without odds", async () => {
    prismaMock.fixture.findMany.mockResolvedValue([
      { id: "f1", homeTeam: "Arsenal", awayTeam: "Brentford" },
    ]);
    prismaMock.market.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: create.key, ...create }),
    );
    prismaMock.odds.findUnique.mockResolvedValue(null);
    prismaMock.odds.create.mockResolvedValue({});

    const written = await backfillFallbackOdds();
    expect(written).toBe(7); // h2h 3 + totals 2 + btts 2
    expect(prismaMock.odds.create).toHaveBeenCalledTimes(7);
    const selectionKeys = prismaMock.odds.create.mock.calls.map((c) => c[0].data.selectionKey);
    expect(selectionKeys).toEqual(
      expect.arrayContaining(["home", "draw", "away", "over_2.5", "under_2.5", "btts_yes", "btts_no"]),
    );
  });

  it("skips fixtures that already have an h2h market (real odds preserved)", async () => {
    prismaMock.fixture.findMany.mockResolvedValue([]);
    const written = await backfillFallbackOdds();
    expect(written).toBe(0);
    const where = prismaMock.fixture.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("SCHEDULED");
    expect(where.markets).toEqual({ none: { key: "h2h" } });
  });

  it("does not overwrite an unchanged existing fallback value", async () => {
    const f = { id: "f2", homeTeam: "Team A", awayTeam: "Team B" };
    const odds = fallbackOdds(f);
    prismaMock.fixture.findMany.mockResolvedValue([f]);
    prismaMock.market.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: create.key, ...create }),
    );
    let existingSeen = 0;
    prismaMock.odds.findUnique.mockImplementation(({ where }) => {
      const sel = where.marketId_selectionKey.selectionKey;
      const all = { ...odds.h2h, ...odds.totals, ...odds.btts } as Record<string, number>;
      const value = all[sel];
      if (existingSeen < 3) {
        existingSeen++;
        return Promise.resolve({ value: { toNumber: () => value } });
      }
      return Promise.resolve(null);
    });
    prismaMock.odds.create.mockResolvedValue({});

    const written = await backfillFallbackOdds();
    expect(written).toBe(4);
  });
});
