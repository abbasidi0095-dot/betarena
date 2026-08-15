import { describe, it, expect, vi, afterEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    fixture: { findMany: vi.fn(), delete: vi.fn() },
    betLeg: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { sameTeam, isDuplicate, cleanupDuplicateFixtures } from "@/server/scheduler/dedup";

afterEach(() => vi.clearAllMocks());

describe("sameTeam — cross-provider name matching", () => {
  it("matches short vs long spellings (Alaves / Deportivo Alavés)", () => {
    expect(sameTeam("Alaves", "Deportivo Alavés")).toBe(true);
    expect(sameTeam("Deportivo Alavés", "Alaves")).toBe(true);
  });

  it("matches with club suffixes (Sevilla / Sevilla FC)", () => {
    expect(sameTeam("Sevilla", "Sevilla FC")).toBe(true);
    expect(sameTeam("Brentford", "Brentford FC")).toBe(true);
  });

  it("rejects different teams", () => {
    expect(sameTeam("Barcelona", "Real Madrid")).toBe(false);
    expect(sameTeam("Alaves", "Athletic Club")).toBe(false);
  });

  it("rejects empty names", () => {
    expect(sameTeam("", "Real Madrid")).toBe(false);
  });
});

describe("isDuplicate — kickoff window + team match", () => {
  const base = { homeTeam: "Alaves", awayTeam: "Sevilla", kickoff: new Date("2026-08-15T17:30:00Z") };

  it("matches same match from another provider", () => {
    expect(
      isDuplicate(base, {
        homeTeam: "Deportivo Alavés",
        awayTeam: "Sevilla FC",
        kickoff: new Date("2026-08-15T17:45:00Z"),
      }),
    ).toBe(true);
  });

  it("rejects when kickoffs differ by more than 20 minutes", () => {
    expect(
      isDuplicate(base, {
        homeTeam: "Deportivo Alavés",
        awayTeam: "Sevilla FC",
        kickoff: new Date("2026-08-15T18:30:00Z"),
      }),
    ).toBe(false);
  });

  it("rejects when teams are swapped or different", () => {
    expect(
      isDuplicate(base, {
        homeTeam: "Deportivo Alavés",
        awayTeam: "Getafe",
        kickoff: new Date("2026-08-15T17:45:00Z"),
      }),
    ).toBe(false);
  });
});

describe("cleanupDuplicateFixtures", () => {
  const KICK = new Date("2026-08-15T17:30:00Z");

  it("deletes football-data fixtures that duplicate an api-football fixture", async () => {
    prismaMock.fixture.findMany.mockResolvedValue([
      { id: "af1", providerId: "1605045", homeTeam: "Alaves", awayTeam: "Sevilla", kickoff: KICK },
      { id: "fd1", providerId: "fd:123", homeTeam: "Deportivo Alavés", awayTeam: "Sevilla FC", kickoff: new Date("2026-08-15T17:40:00Z") },
    ]);
    prismaMock.betLeg.findMany.mockResolvedValue([]);
    prismaMock.fixture.delete.mockResolvedValue({});

    const deleted = await cleanupDuplicateFixtures();
    expect(deleted).toBe(1);
    expect(prismaMock.fixture.delete).toHaveBeenCalledWith({ where: { id: "fd1" } });
  });

  it("migrates bet legs to the twin before deleting", async () => {
    prismaMock.fixture.findMany.mockResolvedValue([
      { id: "af1", providerId: "1605045", homeTeam: "Alaves", awayTeam: "Sevilla", kickoff: KICK },
      { id: "fd1", providerId: "fd:123", homeTeam: "Deportivo Alavés", awayTeam: "Sevilla FC", kickoff: new Date("2026-08-15T17:40:00Z") },
    ]);
    prismaMock.betLeg.findMany.mockResolvedValue([{ fixtureId: "fd1" }, { fixtureId: "fd1" }]);
    prismaMock.betLeg.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.fixture.delete.mockResolvedValue({});

    const deleted = await cleanupDuplicateFixtures();
    expect(deleted).toBe(1);
    expect(prismaMock.betLeg.updateMany).toHaveBeenCalledWith({
      where: { fixtureId: "fd1" },
      data: { fixtureId: "af1" },
    });
    expect(prismaMock.fixture.delete).toHaveBeenCalledWith({ where: { id: "fd1" } });
  });

  it("keeps football-data fixtures with no matching twin", async () => {
    prismaMock.fixture.findMany.mockResolvedValue([
      { id: "fd1", providerId: "fd:123", homeTeam: "Ulsan HD", awayTeam: "Jeonbuk", kickoff: KICK },
    ]);
    prismaMock.betLeg.findMany.mockResolvedValue([]);

    const deleted = await cleanupDuplicateFixtures();
    expect(deleted).toBe(0);
    expect(prismaMock.fixture.delete).not.toHaveBeenCalled();
  });
});
