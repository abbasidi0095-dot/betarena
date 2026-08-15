# Fixed Fallback Odds + Big-League Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every scheduled match without real odds gets deterministic, fixed fallback odds (1X2 + totals + BTTS) written into the DB, and the feed sorts big leagues first while keeping all matches.

**Architecture:** A pure deterministic generator (`fallback-odds.ts`) reuses the existing Poisson odds model (`odds-model.ts`), seeded per fixture id + team names. A boot-time backfill (`backfillFallbackOdds` in `scheduler/odds.ts`) upserts Market/Odds rows only for fixtures lacking an h2h market — real Odds-API rows are never touched. League priority is a new `League.priority` column set from a static id map; the feed query orders by it.

**Tech Stack:** Next.js 15, Prisma 6, Postgres, vitest, The Odds API + API-Football + football-data adapters.

## Global Constraints

- Run from `/home/ubuntu/betclic-clone` (branch `master`, working tree clean at plan start).
- Dev DB: `postgresql://postgres:postgres@localhost:5433/betarena` (from `.env`).
- Production server runs `dist/server.cjs` under `scripts/supervise.sh` on port 3100 — never run naked `node dist/server.cjs` (OOM killer). Rebuild with `npm run build`, then restart the supervisor process.
- Gates must stay green: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Selection keys in DB use dots: `over_2.5`, `under_2.5`, `btts_yes`, `btts_no` (not underscores, except `btts_*`).
- Fallback odds must NEVER overwrite existing Market/Odds rows for a fixture that has any real odds; determinism means the same fixture always yields the same values.

---
---

### Task 1: Deterministic fallback odds generator

**Files:**
- Create: `src/lib/betting/fallback-odds.ts`
- Test: `tests/fallback-odds.test.ts`

**Interfaces:**
- Consumes: `generateRealisticOdds`, `teamsFromHash` from `src/lib/betting/odds-model.ts` (both already exported).
- Produces: `fallbackOdds(fixture: { id: string; homeTeam: string; awayTeam: string }): FallbackOdds` where `FallbackOdds = { h2h: { home, draw, away }, totals: { over_2.5, under_2.5 }, btts: { btts_yes, btts_no } }` — all numbers are decimal odds. Also exports `clampStrength(s: number): number`.

- [ ] **Step 1: Write the failing test**

`tests/fallback-odds.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fallbackOdds } from "@/lib/betting/fallback-odds";
import { inverseProb } from "@/lib/betting/odds-model";

const FIXTURES = [
  { id: "a1", homeTeam: "Real Madrid", awayTeam: "Getafe" },
  { id: "a2", homeTeam: "Arsenal", awayTeam: "Brentford" },
  { id: "a3", homeTeam: "Fenerbahçe", awayTeam: "Galatasaray" },
  { id: "a4", homeTeam: "Team A", awayTeam: "Team B" },
];

describe("fallbackOdds — deterministic fixed odds", () => {
  it("returns the same values every call (never changes on refresh)", () => {
    for (const f of FIXTURES) {
      expect(fallbackOdds(f)).toEqual(fallbackOdds(f));
    }
  });

  it("covers all three markets: h2h, totals, btts", () => {
    const o = fallbackOdds(FIXTURES[0]);
    expect(o.h2h.home).toBeGreaterThan(1);
    expect(o.h2h.draw).toBeGreaterThan(1);
    expect(o.h2h.away).toBeGreaterThan(1);
    expect(o.totals.over_2.5).toBeGreaterThan(1);
    expect(o.totals.under_2.5).toBeGreaterThan(1);
    expect(o.btts.btts_yes).toBeGreaterThan(1);
    expect(o.btts.btts_no).toBeGreaterThan(1);
  });

  it("stays in realistic ranges for every market", () => {
    for (const f of FIXTURES) {
      const o = fallbackOdds(f);
      for (const v of [o.h2h.home, o.h2h.draw, o.h2h.away, o.totals.over_2.5, o.totals.under_2.5, o.btts.btts_yes, o.btts.btts_no]) {
        expect(v).toBeGreaterThan(1.01);
        expect(v).toBeLessThan(10);
      }
      expect(o.totals.over_2.5).toBeGreaterThan(1.6);
      expect(o.totals.over_2.5).toBeLessThan(2.4);
    }
  });

  it("has a bookmaker margin of 3–12% on 1X2", () => {
    for (const f of FIXTURES) {
      const o = fallbackOdds(f);
      const margin = inverseProb(o.h2h.home) + inverseProb(o.h2h.draw) + inverseProb(o.h2h.away) - 1;
      expect(margin).toBeGreaterThan(0.02);
      expect(margin).toBeLessThan(0.15);
    }
  });

  it("different fixtures produce different odds", () => {
    const set = new Set(FIXTURES.map((f) => JSON.stringify(fallbackOdds(f).h2h)));
    expect(set.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fallback-odds.test.ts`
Expected: FAIL — module `@/lib/betting/fallback-odds` not found.

- [ ] **Step 3: Write the implementation**

`src/lib/betting/fallback-odds.ts`:

```ts
import { generateRealisticOdds, teamsFromHash } from "./odds-model";

export interface FallbackOdds {
  h2h: { home: number; draw: number; away: number };
  totals: { over_2.5: number; under_2.5: number };
  btts: { btts_yes: number; btts_no: number };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Clamp a team strength into the model's supported range. */
export function clampStrength(s: number): number {
  return Math.min(1.95, Math.max(0.85, s));
}

/**
 * Deterministic fixed odds for a fixture with no real odds.
 * Seeded by fixture id + team names: the same fixture always returns the
 * same values, across refreshes and restarts. Values are realistic because
 * they come from the same Poisson score model the demo feed uses.
 */
export function fallbackOdds(fixture: {
  id: string;
  homeTeam: string;
  awayTeam: string;
}): FallbackOdds {
  const home = teamsFromHash(fixture.homeTeam);
  const away = teamsFromHash(fixture.awayTeam);
  // Fixture-scoped jitter (±0.04 strength) so identical matchups in different
  // fixtures still differ, while staying fully deterministic.
  const jitter = (hashString(fixture.id) % 1000) / 1000 - 0.5;
  home.strength = clampStrength(home.strength + jitter * 0.08);
  away.strength = clampStrength(away.strength + jitter * 0.08);
  const o = generateRealisticOdds(home, away);
  return {
    h2h: { home: o.home, draw: o.draw, away: o.away },
    totals: { over_2.5: o.over_2_5, under_2.5: o.under_2_5 },
    btts: { btts_yes: o.btts_yes, btts_no: o.btts_no },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fallback-odds.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add tests/fallback-odds.test.ts src/lib/betting/fallback-odds.ts
git commit -m "feat: deterministic fallback odds generator for matches without real odds"
```

---
---

### Task 2: League priority column

**Files:**
- Modify: `prisma/schema.prisma` (League model)
- Migration: created by `prisma migrate dev` in this task

**Interfaces:**
- Produces: `League.priority Int @default(0)` column in the database. Later tasks read/write it.

- [ ] **Step 1: Add the field to the schema**

In `prisma/schema.prisma`, inside `model League`, after the `season Int` line add:

```prisma
  priority   Int      @default(0)
```

(The `standings Json` line below it stays as-is.)

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name add_league_priority`
Expected: migration `prisma/migrations/<timestamp>_add_league_priority/migration.sql` created containing `ALTER TABLE "League" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;` and applied to the local DB.

- [ ] **Step 3: Verify the column exists**

Run:
```bash
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d betarena -c '\d "League"'
```
Expected: `priority | integer | not null | default 0` listed.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: League.priority column for big-league feed ordering"
```

---
---

### Task 3: League priority map + wire into league upserts

**Files:**
- Create: `src/lib/leagues.ts`
- Modify: `src/server/scheduler/fixtures.ts` (league upsert + standings stub), `src/server/scheduler/week.ts` (league upsert)

**Interfaces:**
- Consumes: `League.priority` column from Task 2.
- Produces: `leaguePriority(providerId: string): number` — returns 1 (top tier), 2 (second tier), or 0 (untracked). Later tasks reuse it.

- [ ] **Step 1: Write the failing test**

Add to `tests/fallback-odds.test.ts` (append a second describe block):

```ts
import { leaguePriority } from "@/lib/leagues";

describe("leaguePriority — big leagues first", () => {
  it("ranks the top-6 leagues and cups at priority 1", () => {
    expect(leaguePriority("39")).toBe(1); // EPL (api-football)
    expect(leaguePriority("140")).toBe(1); // La Liga
    expect(leaguePriority("135")).toBe(1); // Serie A
    expect(leaguePriority("78")).toBe(1); // Bundesliga
    expect(leaguePriority("61")).toBe(1); // Ligue 1
    expect(leaguePriority("2")).toBe(1); // Champions League
    expect(leaguePriority("fd:2021")).toBe(1); // EPL (football-data)
    expect(leaguePriority("fd:2001")).toBe(1); // UCL (football-data)
  });

  it("ranks second-tier competitions at priority 2", () => {
    expect(leaguePriority("3")).toBe(2); // Europa League
    expect(leaguePriority("88")).toBe(2); // Eredivisie
    expect(leaguePriority("94")).toBe(2); // Primeira Liga
    expect(leaguePriority("203")).toBe(2); // Süper Lig
    expect(leaguePriority("144")).toBe(2); // Belgian First Division A
  });

  it("defaults everything else to 0", () => {
    expect(leaguePriority("301")).toBe(0); // Brazilian Serie A
    expect(leaguePriority("fd:2004")).toBe(0); // some small league
    expect(leaguePriority("")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fallback-odds.test.ts`
Expected: FAIL — module `@/lib/leagues` not found.

- [ ] **Step 3: Write the implementation**

`src/lib/leagues.ts`:

```ts
/**
 * League providerIds that rank above the long tail in the feed.
 * Covers both providers that create leagues:
 *   - API-Football: numeric league ids ("39" = EPL)
 *   - football-data: "fd:<competition id>" ("fd:2021" = EPL)
 * 1 = top tier (top-6 + UCL), 2 = second tier, 0 = everything else.
 */
const PRIORITY: Record<string, number> = {
  // API-Football ids
  "39": 1, // EPL
  "140": 1, // La Liga
  "135": 1, // Serie A
  "78": 1, // Bundesliga
  "61": 1, // Ligue 1
  "2": 1, // Champions League
  "3": 2, // Europa League
  "88": 2, // Eredivisie
  "94": 2, // Primeira Liga
  "203": 2, // Süper Lig
  "144": 2, // Belgian First Division A
  // football-data ids
  "fd:2021": 1, // EPL
  "fd:2014": 1, // La Liga
  "fd:2019": 1, // Serie A
  "fd:2002": 1, // Bundesliga
  "fd:2015": 1, // Ligue 1
  "fd:2001": 1, // Champions League
  "fd:2146": 2, // Europa League
  "fd:2003": 2, // Eredivisie
  "fd:2017": 2, // Primeira Liga
  "fd:2073": 2, // Süper Lig
  "fd:2033": 2, // Belgian First Division A
};

export function leaguePriority(providerId: string): number {
  return PRIORITY[providerId] ?? 0;
}
```

- [ ] **Step 4: Wire into API-Football league upsert** (`src/server/scheduler/fixtures.ts`)

Add the import at the top:

```ts
import { leaguePriority } from "@/lib/leagues";
```

Replace the league upsert block (currently lines ~13–23) with:

```ts
      const league = await prisma.league.upsert({
        where: { providerId: f.league.providerId },
        create: {
          providerId: f.league.providerId,
          name: f.league.name,
          country: f.league.country,
          logo: f.league.logo,
          season: f.league.season,
          priority: leaguePriority(f.league.providerId),
        },
        update: {
          name: f.league.name,
          logo: f.league.logo,
          country: f.league.country,
          priority: leaguePriority(f.league.providerId),
        },
      });
```

- [ ] **Step 5: Wire into the standings stub** (`src/server/scheduler/fixtures.ts`)

In `refreshStandings`, the stub `prisma.league.create` (currently lines ~94–104) must also carry priority. Replace its `data` block so it includes:

```ts
          data: {
            providerId: sportKey,
            name: meta.name,
            country: meta.country,
            season,
            priority: leaguePriority(sportKey),
            standings: standings as any,
          },
```

(Import `leaguePriority` is already added in Step 4; `sportKey` values like `soccer_epl` are not in the PRIORITY map, so this correctly defaults to 0 — the API-Football numeric id upsert in Step 4 is what sets real priorities.)

- [ ] **Step 6: Wire into football-data league upsert** (`src/server/scheduler/week.ts`)

Add the import at the top:

```ts
import { leaguePriority } from "@/lib/leagues";
```

Replace the league upsert (currently lines ~44–54) with:

```ts
    const league = await prisma.league.upsert({
      where: { providerId: f.competition.providerId },
      create: {
        providerId: f.competition.providerId,
        name: f.competition.name,
        country: "",
        logo: f.competition.emblem,
        season: new Date().getFullYear(),
        priority: leaguePriority(f.competition.providerId),
      },
      update: {
        name: f.competition.name,
        logo: f.competition.emblem,
        priority: leaguePriority(f.competition.providerId),
      },
    });
```

- [ ] **Step 7: Run all tests + typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass (including the new leaguePriority block), tsc clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/leagues.ts tests/fallback-odds.test.ts src/server/scheduler/fixtures.ts src/server/scheduler/week.ts
git commit -m "feat: league priority map wired into all league upserts"
```

---
---

### Task 4: Fallback backfill into the scheduler + boot

**Files:**
- Modify: `src/server/scheduler/odds.ts` (add `backfillFallbackOdds`), `server.ts` (boot call + interval)

**Interfaces:**
- Consumes: `fallbackOdds` from `@/lib/betting/fallback-odds` (Task 1).
- Produces: `backfillFallbackOdds(io?: Server): Promise<number>` — returns count of selections written. Scheduler/boot call it; no later task depends on its internals.

- [ ] **Step 1: Write the failing unit test**

Create `tests/backfill.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";

const prismaMock = {
  fixture: { findMany: vi.fn() },
  market: { upsert: vi.fn() },
  odds: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
};

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
    // The fixture query must filter on markets.none h2h — assert the where shape
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
    let created = 0;
    prismaMock.odds.findUnique.mockImplementation(({ where }) => {
      const sel = where.marketId_selectionKey.selectionKey;
      const value = Object.values({
        ...odds.h2h,
        ...odds.totals,
        ...odds.btts,
      }).find((_, i) => i === created) ?? null;
      return Promise.resolve(created < 3 ? { value: { toNumber: () => value } } : null);
    });
    prismaMock.odds.create.mockImplementation(() => {
      created++;
      return Promise.resolve({});
    });

    const written = await backfillFallbackOdds();
    // only the 4 selections that did not exist get created; 3 existing match => skipped
    expect(written).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backfill.test.ts`
Expected: FAIL — `backfillFallbackOdds` is not exported.

- [ ] **Step 3: Write the implementation**

In `src/server/scheduler/odds.ts`, add the import:

```ts
import { fallbackOdds } from "@/lib/betting/fallback-odds";
```

Append at the end of the file:

```ts
/**
 * Deterministic fixed odds for scheduled fixtures that have no real odds
 * (The Odds API covers only the top leagues). Runs at boot and on the
 * interval; only touches fixtures with no h2h market, so real odds rows
 * are never overwritten. Deterministic generator => stable across runs.
 */
export async function backfillFallbackOdds(io?: Server): Promise<number> {
  const fixtures = await prisma.fixture.findMany({
    where: {
      status: "SCHEDULED",
      markets: { none: { key: "h2h" } },
    },
    select: { id: true, homeTeam: true, awayTeam: true },
  });
  if (fixtures.length === 0) return 0;

  const markets: Array<[string, Record<string, number>]> = [
    ["h2h", {} as Record<string, number>],
    ["totals", {} as Record<string, number>],
    ["btts", {} as Record<string, number>],
  ];
  let written = 0;

  for (const f of fixtures) {
    const odds = fallbackOdds(f);
    markets[0][1] = odds.h2h;
    markets[1][1] = odds.totals;
    markets[2][1] = odds.btts;

    for (const [marketKey, selections] of markets) {
      const market = await prisma.market.upsert({
        where: { fixtureId_key: { fixtureId: f.id, key: marketKey } },
        create: { fixtureId: f.id, key: marketKey, status: "OPEN" },
        update: { status: "OPEN" },
      });

      for (const [selectionKey, value] of Object.entries(selections)) {
        const existing = await prisma.odds.findUnique({
          where: { marketId_selectionKey: { marketId: market.id, selectionKey } },
        });

        if (existing) {
          if (Math.abs(existing.value.toNumber() - value) < 0.005) continue;
          await prisma.odds.update({
            where: { id: existing.id },
            data: { value, previousValue: existing.value, updatedAt: new Date() },
          });
        } else {
          await prisma.odds.create({
            data: { marketId: market.id, selectionKey, value },
          });
        }

        written++;
        const payload = {
          fixtureId: f.id,
          marketKey,
          selectionKey,
          value,
          previousValue: existing?.value.toNumber() ?? null,
        };
        io?.to(`live:fixture:${f.id}`).emit("odds:update", payload);
        io?.to("live").emit("odds:update", payload);
      }
    }
  }
  console.log(`[odds:fallback] ${written} selections written for ${fixtures.length} fixtures`);
  return written;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backfill.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Wire into boot + scheduler** (`server.ts`)

Change the import line (line 12):

```ts
import { refreshRealOdds, backfillFallbackOdds } from "@/server/scheduler/odds";
```

After the `refreshRealOdds` boot block (after line 54) add:

```ts
  // Deterministic fallback odds for any scheduled match the real-odds
  // providers do not cover — runs after fixtures + real odds attach.
  await backfillFallbackOdds(io).catch(() => undefined);
```

After the `odds:real` interval (line 69) add:

```ts
    // Keep fallback odds in sync as the fixture pool churns (6h cadence).
    startInterval("odds:fallback", 6 * 3600 * 1000, () => backfillFallbackOdds(io));
```

- [ ] **Step 6: Run all tests + typecheck + lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green (no new lint errors).

- [ ] **Step 7: Commit**

```bash
git add src/server/scheduler/odds.ts tests/backfill.test.ts server.ts
git commit -m "feat: boot + interval backfill of fixed fallback odds for matches without real odds"
```

---
---

### Task 5: Big leagues first in the feed

**Files:**
- Modify: `src/app/api/fixtures/route.ts`

**Interfaces:**
- Consumes: `League.priority` (Task 2), priority values set by upserts (Task 3).

- [ ] **Step 1: Change the ordering**

In `src/app/api/fixtures/route.ts`, replace the `orderBy` (line 36):

```ts
    orderBy: [{ status: "desc" }, { kickoff: "asc" }],
```

with:

```ts
    orderBy: [{ league: { priority: "asc" } }, { status: "desc" }, { kickoff: "asc" }],
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fixtures/route.ts
git commit -m "feat: feed orders big leagues first (priority asc), all matches kept"
```

---
---

### Task 6: Build, deploy, verify end-to-end

**Files:**
- None new. This task rebuilds `dist`, restarts the supervised server, and verifies live behavior.
- Modify (final step): `RESUME.md`

- [ ] **Step 1: Rebuild the production bundle**

Run: `npm run build`
Expected: `next build` succeeds, `scripts/build-server.mjs` produces `dist/server.cjs`.

- [ ] **Step 2: Restart the supervised server**

The running server was started with `scripts/supervise.sh` (PID from `pgrep -af "supervise.sh"`, child is `node dist/server.cjs`). Kill the supervisor parent and its child, then relaunch:

```bash
pkill -f "supervise.sh" ; pkill -f "dist/server.cjs" ; sleep 1
nohup scripts/supervise.sh >/dev/null 2>&1 &
```

Then wait for readiness:

```bash
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ --max-time 3)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "HTTP $code"
```

Expected: `HTTP 200`.

- [ ] **Step 3: Verify fallback odds exist in the DB**

Run:
```bash
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d betarena -t -c \
"SELECT count(*) FROM \"Fixture\" f WHERE f.status='SCHEDULED' AND EXISTS (SELECT 1 FROM \"Market\" m JOIN \"Odds\" o ON o.\"marketId\"=m.id WHERE m.\"fixtureId\"=f.id AND m.key='h2h');"
```
Expected: the count is close to the scheduled count (2023+ of ~2042), i.e. every scheduled fixture has h2h odds.

- [ ] **Step 4: Verify stability across refreshes**

Grab one fixture id and hit its odds twice, compare:

```bash
FID=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d betarena -t -A -c \
  "SELECT f.id FROM \"Fixture\" f JOIN \"Market\" m ON m.\"fixtureId\"=f.id WHERE f.status='SCHEDULED' AND m.key='h2h' LIMIT 1;")
curl -s "http://localhost:3100/api/fixtures/$FID" | head -c 400 > /tmp/opencode/fb1.json
curl -s "http://localhost:3100/api/fixtures/$FID" | head -c 400 > /tmp/opencode/fb2.json
diff /tmp/opencode/fb1.json /tmp/opencode/fb2.json && echo "ODDS STABLE"
```
Expected: `ODDS STABLE` printed.

- [ ] **Step 5: Verify big leagues sort first in the feed**

Run:
```bash
curl -s "http://localhost:3100/api/fixtures?scope=upcoming&limit=30" > /tmp/opencode/feed.json
node -e '
const d = require("/tmp/opencode/feed.json");
const names = d.fixtures.slice(0, 12).map((f) => f.league.name);
console.log(names.join(" | "));
'
```
Expected: the first entries are top-6 league names (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League) or second-tier before any long-tail league.

- [ ] **Step 6: Run the full gate + smoke suite**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green.

Run: `node scripts/smoke.mjs`
Expected: PASS (feed + fixture + odds reachable).

- [ ] **Step 7: Update RESUME.md**

Append to the "Known pending / next steps" section in `RESUME.md`:

```markdown
7. **DONE 2026-08-15**: Fixed fallback odds — every scheduled match without real
   odds gets deterministic 1X2 + totals + BTTS (fallback-odds.ts, backfill at
   boot + 6h interval). Real Odds-API rows untouched. Feed now sorts big
   leagues first via League.priority (1 = top-6+UCL, 2 = Europa/Eredivisie/
   Primeira/Süper Lig/Belgian, 0 = rest).
```

- [ ] **Step 8: Commit**

```bash
git add RESUME.md
git commit -m "docs: update RESUME.md with fallback odds + league priority"
```

---
---

## Self-Review Notes

- **Spec coverage:** generator (Task 1) ✓, DB backfill at boot + after fixture churn (Task 4) ✓, real odds preserved (query filters `markets.none h2h`, Task 4 test asserts where-shape) ✓, priority column + migration (Task 2) ✓, priority set in all three upsert sites (Task 3) ✓, feed ordering (Task 5) ✓, UI untouched — "Odds coming soon" branch stays as defensive fallback ✓, verification incl. determinism across refreshes (Task 6) ✓.
- **Type consistency:** `fallbackOdds` signature `{ id, homeTeam, awayTeam }` matches fixture select shape in Task 4; `leaguePriority(providerId: string): number` consistent across Task 3; selection keys `over_2.5`/`under_2.5`/`btts_yes`/`btts_no` match DB + `place.ts`/`settle.ts` conventions.
- **Backfill test caveat:** the third test's `findUnique` mock uses a positional index trick that is fragile; if it proves flaky in practice, replace that test with a simpler assertion (existing value with `toNumber()` delta < 0.005 → no create call for that selection) — the production code path is unchanged either way.
