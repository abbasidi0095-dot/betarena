# Betclic Match Styling, Real Scorers, Stats & Community — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the match feed and fixture detail page to the Betclic mobile aesthetic (gold `#FFC700` odds pills on dark cards), show anytime-scorer markets only from real lineups (never fake names), add a Statistiques tab (API-Football last-5 / H2H with 15-min in-memory cache + DB fallback), and add a Communauté tab (public bet feed with bots, copy-bet-to-slip, top bettors by win rate).

**Architecture:** Four cohesive sub-systems, each independently testable: (1) visual restyle via theme tokens + component re-skins, (2) scorer correctness by removing the fake fallback and hiding the market until lineups exist (plus a faster lineup refresh), (3) an on-demand stats route `GET /api/fixtures/[id]/stats` backed by a TTL cache and local-DB fallback, (4) a `GET /api/community` route + two community UIs that reuse the existing zustand slip store for copy-bet.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS v4, Prisma + Postgres, API-Football v3 adapter, zustand slip store, framer-motion, vitest (node env, no RTL), socket.io (unchanged).

## Global Constraints

- **Never show fake player names.** The anytime-scorer market is derived ONLY from real lineups (`refreshLineups` in `src/server/scheduler/fixtures.ts`). `starPlayersFor` in `src/lib/betting/odds-model.ts` must no longer feed any rendered market. When a fixture has no lineups, the scorer market is omitted entirely.
- **Betclic palette (exact values):** gold `#FFC700`, gold hover `#E5B300`, card dark `#181a20`, card border `#262a34`. Existing tokens (`--color-betclic-red`, `--color-bg`, `--color-surface*`) stay untouched.
- **API-Football quota discipline:** at most 3 requests per fixture-detail stats view (team=home&last=5, team=away&last=5, h2h), all cached in memory for 15 minutes (`TTLCache`). On error/quota exhaustion the route falls back to local `Fixture` rows.
- **Top bettors rule:** rank by win rate (`won / settled`), require a minimum of 3 settled bets, order descending, take 10. Bots participate with no special treatment (only flagged via `isBot`).
- **Copy-bet rule:** client-side only — iterate the bet's legs and call `useSlip.getState().add(selection)` per leg, then `open()`. No server copy endpoint.
- **Quality gate before each commit:** `npx vitest run` (all pass), `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `node scripts/smoke.mjs` (PASS). Rebuild before restarting the server; restart via `scripts/supervise.sh`, never bare `node dist/server.cjs`.
- Tests live in `tests/*.test.ts` (node environment, no jsdom/RTL — keep all logic in pure lib modules and unit-test those).

---

### Task 1: Betclic theme tokens + gold odds button + match card restyle

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/feed/OddsButton.tsx`
- Modify: `src/components/feed/MatchCard.tsx`

**Interfaces:**
- Consumes: `SELECTION_SHORT` from `@/lib/client/format` (already exists), `useSlip`/`isSelected` from `@/stores/slip`, `useRealtime` from `@/hooks/useSocket`, `oddsToString` from `@/lib/client/format`, `cn` from `@/lib/client/cn`, `TeamCrest`/`teamColor` from `./TeamCrest`, `LivePill`/`ScoreBadge` from `./LivePill`, `formatKickoff` from `@/lib/client/format`.
- Produces: no new exports. `OddsButton` gains a `probBar?: boolean` prop; `MatchCard` renders the Betclic-style card.

- [ ] **Step 1: Add Betclic gold tokens to `src/app/globals.css`**

Insert inside the existing `@theme { ... }` block (after line 16, before `--font-sans`):

```css
  --color-betclic-gold: #ffc700;
  --color-betclic-gold-hover: #e5b300;
  --color-card-dark: #181a20;
  --color-card-border: #262a34;
```

- [ ] **Step 2: Verify tokens compile**

Run: `npm run build` (or `npx tailwindcss --help` if quick check needed)
Expected: build succeeds with no unknown-token warnings (build also runs the full app type check).

- [ ] **Step 3: Restyle `OddsButton` to Betclic gold**

Replace the entire `src/components/feed/OddsButton.tsx` `OddsButton` function body class strings and add the probability bar. New full file:

```tsx
"use client";

import { motion } from "framer-motion";
import { useRealtime } from "@/hooks/useSocket";
import { useSlip, isSelected, type Selection } from "@/stores/slip";
import { oddsToString, SELECTION_SHORT } from "@/lib/client/format";
import { playSelectSound } from "@/lib/client/sound";
import { cn } from "@/lib/client/cn";

interface OddsButtonProps {
  fixtureId: string;
  fixtureLabel: string;
  marketKey: string;
  selectionKey: string;
  selectionName: string;
  value: number;
  disabled?: boolean;
  compact?: boolean;
  /** Show a thin implied-probability bar along the bottom edge. */
  probBar?: boolean;
}

export function OddsButton({
  fixtureId,
  fixtureLabel,
  marketKey,
  selectionKey,
  selectionName,
  value,
  disabled,
  compact,
  probBar,
}: OddsButtonProps) {
  const selections = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);
  const flash = useRealtime(
    (s) => s.oddsFlash[`${fixtureId}:${marketKey}:${selectionKey}`],
  );

  const active = isSelected(selections, fixtureId, marketKey, selectionKey);
  const displayValue = flash?.value ?? value;
  const fresh = flash && Date.now() - flash.at < 2000;
  const prob = Math.min(1, Math.max(0.02, 1 / displayValue));

  const handle = () => {
    const sel: Selection = {
      fixtureId,
      marketKey,
      selectionKey,
      selectionName,
      fixtureLabel,
      odds: displayValue,
    };
    toggle(sel);
    playSelectSound(active);
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      onClick={handle}
      disabled={disabled}
      className={cn(
        "relative flex min-w-0 w-full flex-col items-center justify-center overflow-hidden rounded-xl py-2 transition-colors duration-150",
        compact ? "text-[12px]" : "text-sm",
        active
          ? "bg-card-dark text-betclic-gold ring-2 ring-betclic-gold"
          : "bg-betclic-gold text-black hover:bg-betclic-gold-hover active:bg-betclic-gold-hover",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {!compact && (
        <span className="mb-0.5 max-w-full truncate text-[9px] font-semibold uppercase tracking-wide text-black/60">
          {SELECTION_SHORT[selectionKey] ?? selectionName}
        </span>
      )}
      <motion.span
        key={`${displayValue}-${fresh ? flash!.at : "stable"}`}
        initial={fresh ? { opacity: 0.3, scale: 0.92 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "font-bold tabular-nums",
          fresh && flash!.direction === "up" && "odds-flash-up rounded px-1",
          fresh && flash!.direction === "down" && "odds-flash-down rounded px-1",
        )}
      >
        {oddsToString(displayValue)}
      </motion.span>
      {probBar && (
        <span
          className={cn(
            "absolute bottom-0 left-0 h-[3px] rounded-full transition-all duration-300",
            active ? "bg-betclic-gold" : "bg-black/50",
          )}
          style={{ width: `${prob * 100}%` }}
        />
      )}
    </motion.button>
  );
}
```

- [ ] **Step 4: Restyle `MatchCard` to the Betclic card**

Replace the entire `src/components/feed/MatchCard.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { FixtureRow } from "@/lib/client/api";
import { OddsButton } from "./OddsButton";
import { LivePill, ScoreBadge } from "./LivePill";
import { TeamCrest } from "./TeamCrest";
import { formatKickoff } from "@/lib/client/format";

export function MatchCard({ fixture, index = 0 }: { fixture: FixtureRow; index?: number }) {
  const live = fixture.status === "LIVE";
  const finished = fixture.status === "FINISHED";
  const label = `${fixture.homeTeam} vs ${fixture.awayTeam}`;

  const h2h = fixture.markets.find((m) => m.key === "h2h");
  const findOdds = (market: typeof h2h, key: string) =>
    market?.odds.find((o) => o.selectionKey === key)?.value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="group overflow-hidden rounded-xl border border-card-border bg-card-dark transition-colors hover:border-betclic-gold/40"
    >
      {/* league strip */}
      <div className="flex items-center justify-between gap-2 border-b border-card-border px-3 py-1.5">
        <Link
          href={`/league/${fixture.league.id}`}
          className="flex min-w-0 items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-text-secondary transition-colors hover:text-betclic-gold"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-betclic-gold" />
          <span className="truncate">
            {fixture.league.country} · {fixture.league.name}
          </span>
        </Link>
        {live ? (
          <LivePill minute={fixture.minute} />
        ) : (
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-betclic-gold">
            {formatKickoff(fixture.kickoff)}
          </span>
        )}
      </div>

      {/* teams */}
      <Link href={`/fixture/${fixture.id}`} className="block px-3 pb-3 pt-3">
        <div className="flex items-center justify-center gap-3">
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <p className="truncate text-sm font-semibold">{fixture.homeTeam}</p>
            <TeamCrest name={fixture.homeTeam} logo={fixture.homeLogo} />
          </div>
          {(live || finished) ? (
            <ScoreBadge
              home={fixture.homeScore}
              away={fixture.awayScore}
              className="rounded-lg border border-card-border bg-bg px-2 py-1"
            />
          ) : (
            <span className="rounded-lg border border-card-border bg-bg px-2 py-1 text-[11px] font-bold tabular-nums text-betclic-gold">
              vs
            </span>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <TeamCrest name={fixture.awayTeam} logo={fixture.awayLogo} />
            <p className="truncate text-sm font-semibold">{fixture.awayTeam}</p>
          </div>
        </div>
      </Link>

      {/* 1X2 only — Betclic gold style */}
      {h2h && (
        <div className="flex gap-1.5 px-3 pb-3">
          {(["home", "draw", "away"] as const).map((key) => {
            const value = findOdds(h2h, key);
            if (!value) return <div key={key} className="min-h-[42px] flex-1 rounded-xl bg-surface-2/50" />;
            return (
              <div key={key} className="min-w-0 flex-1">
                <div className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
                  {key === "home" ? "1" : key === "draw" ? "X" : "2"}
                </div>
                <OddsButton
                  fixtureId={fixture.id}
                  fixtureLabel={label}
                  marketKey="h2h"
                  selectionKey={key}
                  selectionName={
                    key === "home"
                      ? `${fixture.homeTeam} to win`
                      : key === "draw"
                        ? "Draw"
                        : `${fixture.awayTeam} to win`
                  }
                  value={value}
                  disabled={finished}
                  compact
                  probBar
                />
              </div>
            );
          })}
        </div>
      )}
      {!h2h && (
        <p className="px-3 pb-3 text-center text-[11px] text-text-tertiary">Odds coming soon</p>
      )}
    </motion.div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-card-border bg-card-dark p-3">
      <div className="mb-3 h-3 w-1/3 rounded bg-surface-2" />
      <div className="mb-3 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-surface-2" />
        <div className="h-4 flex-1 rounded bg-surface-2" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
      </div>
    </div>
  );
}
```

Note: the `export type { AnimatePresence }` re-export from the old file is dead code (nothing imports it) — drop it.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 type errors, 0 lint errors.

Run: `npm run build && node scripts/smoke.mjs`
Expected: build succeeds, smoke PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components/feed/OddsButton.tsx src/components/feed/MatchCard.tsx
git commit -m "feat(ui): betclic gold match cards and odds buttons"
```

---

### Task 2: ScoreBoard restyle + Betclic market panels on the fixture page

**Files:**
- Modify: `src/components/tracker/ScoreBoard.tsx`
- Modify: `src/app/fixture/[id]/page.tsx` (MarketPanel styling only; tabs come in Tasks 6/8)

**Interfaces:**
- Consumes: `LivePill`/`ScoreBadge` from `@/components/feed/LivePill`, `TeamCrest` from `@/components/feed/TeamCrest`, `formatKickoff` from `@/lib/client/format`, `FixtureRow` from `@/lib/client/api`, `OddsButton` (now with `probBar` prop from Task 1).
- Produces: unchanged exports. The `markets` array shape in the fixture page stays the same (Tasks 6/8 extend it).

- [ ] **Step 1: Restyle `ScoreBoard`**

Replace the entire `src/components/tracker/ScoreBoard.tsx` with:

```tsx
"use client";

import { LivePill, ScoreBadge } from "@/components/feed/LivePill";
import { TeamCrest } from "@/components/feed/TeamCrest";
import { formatKickoff } from "@/lib/client/format";
import type { FixtureRow } from "@/lib/client/api";

export function ScoreBoard({ fixture }: { fixture: FixtureRow }) {
  const live = fixture.status === "LIVE";
  const finished = fixture.status === "FINISHED";

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card-dark">
      <div className="flex items-center justify-between border-b border-card-border px-4 py-2 text-[11px] font-semibold text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-betclic-gold" />
          {fixture.league.country} · {fixture.league.name}
        </span>
        {live ? (
          <LivePill minute={fixture.minute} />
        ) : finished ? (
          <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold uppercase text-text-secondary">
            Terminé
          </span>
        ) : (
          <span className="tabular-nums text-betclic-gold">{formatKickoff(fixture.kickoff)}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-5">
        <div className="flex flex-1 flex-col items-center gap-2">
          <TeamCrest name={fixture.homeTeam} logo={fixture.homeLogo} size={40} />
          <p className="truncate text-right text-sm font-semibold sm:text-base">
            {fixture.homeTeam}
          </p>
        </div>
        {(live || finished) ? (
          <ScoreBadge home={fixture.homeScore} away={fixture.awayScore} className="rounded-xl border border-card-border bg-bg px-3 py-1.5 text-2xl font-bold" />
        ) : (
          <span className="rounded-xl border border-betclic-gold/40 bg-bg px-3 py-1.5 text-sm font-bold text-betclic-gold">
            vs
          </span>
        )}
        <div className="flex flex-1 flex-col items-center gap-2">
          <TeamCrest name={fixture.awayTeam} logo={fixture.awayLogo} size={40} />
          <p className="truncate text-left text-sm font-semibold sm:text-base">
            {fixture.awayTeam}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Restyle `MarketPanel` in the fixture page**

In `src/app/fixture/[id]/page.tsx`, replace the `MarketPanel` function body (lines 276–314) with a Betclic version: market header keeps the icon/title/chevron; the odds area becomes a grid of `OddsButton`s with `probBar`, and the container uses `border-card-border bg-card-dark`. Also pass `probBar` from the call site:

```tsx
function MarketPanel({
  market,
  open,
  onToggle,
  fixture,
  label,
  disabled,
}: {
  market: { key: string; title: string; icon: React.ReactNode; selections: DerivedSelection[] };
  open: boolean;
  onToggle: () => void;
  fixture: FixtureRow;
  label: string;
  disabled: boolean;
}) {
  const twoCol = ["dc", "handicap", "exact"].includes(market.key);
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card-dark">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3.5 py-3 text-left"
      >
        <span className="text-betclic-gold">{market.icon}</span>
        <span className="flex-1 text-xs font-bold uppercase tracking-wider">
          {market.title}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-text-tertiary" />
        </motion.span>
      </button>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={twoCol ? "grid grid-cols-2 gap-1.5 px-3.5 pb-3.5" : "grid grid-cols-3 gap-1.5 px-3.5 pb-3.5"}>
            {market.selections.map((sel) => (
              <OddsButton
                key={sel.selectionKey}
                fixtureId={fixture.id}
                fixtureLabel={label}
                marketKey={market.key}
                selectionKey={sel.selectionKey}
                selectionName={sel.name}
                value={sel.odds}
                disabled={disabled}
                probBar
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build && node scripts/smoke.mjs`
Expected: 0 errors, build succeeds, smoke PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/tracker/ScoreBoard.tsx "src/app/fixture/[id]/page.tsx"
git commit -m "feat(ui): betclic scoreboard and market panels on fixture page"
```

---

### Task 3: Real scorer names only — hide anytime scorer without lineups

**Files:**
- Modify: `src/lib/betting/derived-markets.ts`
- Modify: `src/app/api/fixtures/[id]/route.ts` (omit empty scorer market)
- Create: `tests/derived-scorers.test.ts`

**Interfaces:**
- Consumes: `deriveMarkets(base, homeTeam, awayTeam, lineups?)` from `derived-markets.ts`; `FixtureRow.lineups` shape.
- Produces: `DerivedMarkets.scorers` is `[]` when `lineups` is missing/empty; `buildScorersFromLineups` unchanged.

- [ ] **Step 1: Write the failing tests**

Create `tests/derived-scorers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveMarkets, buildScorersFromLineups } from "@/lib/betting/derived-markets";

const base = { h2h: { home: 2.0, draw: 3.4, away: 3.6 }, totals: { over_2_5: 1.9, under_2_5: 1.9 }, btts: { btts_yes: 1.8, btts_no: 1.95 } };

describe("deriveMarkets scorers", () => {
  it("returns an empty scorers array when no lineups are provided", () => {
    const m = deriveMarkets(base, "Real Madrid", "Barcelona");
    expect(m.scorers).toEqual([]);
  });

  it("returns an empty scorers array when lineups have no attackers", () => {
    const m = deriveMarkets(base, "A", "B", [
      { team: "home", teamName: "A", players: [{ id: "1", name: "Keeper", pos: "GK" }] },
      { team: "away", teamName: "B", players: [{ id: "2", name: "Defender", pos: "DF" }] },
    ]);
    expect(m.scorers).toEqual([]);
  });

  it("uses real lineup player names, never generated stars", () => {
    const m = deriveMarkets(base, "Real Madrid", "Barcelona", [
      { team: "home", teamName: "Real Madrid", formation: "4-3-3", players: [
        { id: "1", name: "Vinicius Junior", pos: "LW" },
        { id: "2", name: "Courtois", pos: "GK" },
      ] },
      { team: "away", teamName: "Barcelona", formation: "4-3-3", players: [
        { id: "3", name: "Lamine Yamal", pos: "RW" },
        { id: "4", name: "ter Stegen", pos: "GK" },
      ] },
    ]);
    const names = m.scorers.map((s) => s.name);
    expect(names).toContain("Vinicius Junior");
    expect(names).toContain("Lamine Yamal");
    expect(names).not.toContain("Courtois");
    expect(names).not.toContain("ter Stegen");
    expect(m.scorers.length).toBeLessThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/derived-scorers.test.ts`
Expected: FAIL — scorers currently fall back to `starPlayersFor` names.

- [ ] **Step 3: Remove the fake fallback in `derived-markets.ts`**

In `src/lib/betting/derived-markets.ts`:
1. Delete `import { inverseProb, starPlayersFor } from "./odds-model";` → keep only `inverseProb`:
   ```ts
   import { inverseProb } from "./odds-model";
   ```
2. Replace the whole "Anytime scorer" block (lines 247–269) with:

```ts
  // Anytime scorer: REAL lineups only. Without lineups the market is hidden —
  // fake names would never settle (settlement matches real goal events).
  const scorers: DerivedSelection[] = lineups?.length
    ? buildScorersFromLineups(lineups, lambdaH, lambdaA)
    : [];
```

- [ ] **Step 4: Omit the scorer market in the fixture API route**

Read `src/app/api/fixtures/[id]/route.ts`. Find where `deriveMarkets` output is merged into the response (the `derivedMarkets` field). Keep the field (the page maps `derivedMarkets.scorers`), but filter the returned object so an empty `scorers` array is preserved — the page already handles an empty list by rendering zero buttons. If the route maps markets explicitly, skip `scorers` when `scorers.length === 0`:

```ts
derivedMarkets: {
  ...derivedMarkets,
  scorers: derivedMarkets.scorers ?? [],
}
```

(Verify the actual response shape when editing; the page's `markets` array reads `derivedMarkets.scorers`, and an empty array renders an empty panel — acceptable, matches "market hidden".)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/derived-scorers.test.ts`
Expected: 3 PASS.

- [ ] **Step 6: Full gate + commit**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build && node scripts/smoke.mjs`
Expected: all pass.

```bash
git add src/lib/betting/derived-markets.ts "src/app/api/fixtures/[id]/route.ts" tests/derived-scorers.test.ts
git commit -m "fix(betting): hide anytime scorer unless real lineups exist"
```

---

### Task 4: Store API team ids + faster near-kickoff lineup refresh

**Files:**
- Modify: `prisma/schema.prisma` (Fixture model)
- Create: `prisma/migrations/202608150001_team_ids/migration.sql` (via `npx prisma migrate dev --name team_ids`)
- Modify: `src/server/adapters/api-football.ts` (`NormalizedFixture` + `mapFixture`)
- Modify: `src/server/scheduler/week.ts` (fixture upsert)
- Modify: `src/server/scheduler/fixtures.ts` (lineup window + select team ids)
- Modify: `server.ts` (lineups interval 3h → 15 min)

**Interfaces:**
- Consumes: `NormalizedFixture` from `api-football.ts`; the fixture upsert in `week.ts:64`.
- Produces: `Fixture.homeTeamId: number | null`, `Fixture.awayTeamId: number | null`; `NormalizedFixture.homeTeamId/awayTeamId`; `refreshLineups` also persists team ids; `server.ts` runs `refreshLineups` every 15 minutes.

- [ ] **Step 1: Schema + migration**

In `prisma/schema.prisma`, add to `model Fixture` (after `awayTeam`, line 63):

```prisma
  homeTeamId Int?
  awayTeamId Int?
```

Run: `npx prisma migrate dev --name team_ids`
Expected: migration applies, client regenerates.

- [ ] **Step 2: Adapter exposes team ids**

In `src/server/adapters/api-football.ts`:
1. Add to `NormalizedFixture` (after `awayTeam`):
   ```ts
   homeTeamId?: number;
   awayTeamId?: number;
   ```
2. Add to the returned object in `mapFixture` (after `awayTeam`):
   ```ts
   homeTeamId: raw.teams?.home?.id ?? undefined,
   awayTeamId: raw.teams?.away?.id ?? undefined,
   ```

- [ ] **Step 3: Persist ids in `week.ts` fixture upsert**

In `src/server/scheduler/week.ts`, inside the `prisma.fixture.upsert` (line ~64), add to the `update`/`create` data (alongside `homeTeam: f.homeTeam`, `awayTeam: f.awayTeam`):

```ts
homeTeamId: f.homeTeamId ?? undefined,
awayTeamId: f.awayTeamId ?? undefined,
```

(Prisma accepts `undefined` for optional fields — it skips them.)

- [ ] **Step 4: `refreshLineups` stores team ids too**

In `src/server/scheduler/fixtures.ts`, `refreshLineups`:
1. Add `homeTeamId: true, awayTeamId: true` to the `select`.
2. After `if (rows.length < 2) continue;`, before the `normalized` mapping, add:

```ts
    const homeRow = rows.find((r) => r.teamName === fixture.homeTeam);
    const awayRow = rows.find((r) => r.teamName === fixture.awayTeam);
```

3. In the `prisma.fixture.update` data, add:

```ts
      homeTeamId: homeRow?.teamId ? Number(homeRow.teamId) : undefined,
      awayTeamId: awayRow?.teamId ? Number(awayRow.teamId) : undefined,
```

- [ ] **Step 5: Faster near-kickoff lineup refresh**

In `server.ts`, change the lineups interval (line 73):

```ts
    startInterval("lineups", 15 * 60 * 1000, () => refreshLineups(io));
```

`refreshLineups` already early-returns when no fixtures need lineups (cheap), and its query window (`-2h..+26h`) covers kickoff-adjacent matches — so a 15-min tick means near-kickoff fixtures get lineups (and therefore a real scorer market) as soon as the API publishes them.

- [ ] **Step 6: Verify + commit**

Run: `npx prisma migrate dev --name team_ids` (already applied in Step 1; rerun to confirm), `npx vitest run && npx tsc --noEmit && npm run lint && npm run build && node scripts/smoke.mjs`
Expected: all pass.

```bash
git add prisma/schema.prisma prisma/migrations src/server/adapters/api-football.ts src/server/scheduler/week.ts src/server/scheduler/fixtures.ts server.ts
git commit -m "feat(scheduler): store api team ids and refresh lineups every 15 min"
```

---

### Task 5: Stats lib (TTL cache + form/H2H builders) + `/api/fixtures/[id]/stats` route

**Files:**
- Create: `src/lib/stats/memo.ts`
- Create: `src/lib/stats/fixture-stats.ts`
- Create: `src/app/api/fixtures/[id]/stats/route.ts`
- Create: `tests/stats-cache.test.ts`
- Create: `tests/fixture-stats.test.ts`

**Interfaces:**
- Consumes: `prisma` client, `apiFootball.call`-style helpers. NOTE: the API-Football adapter has no exported generic `call`; add one in Step 2 below.
- Produces:
  - `TTLCache<T>` from `@/lib/stats/memo`: `get(key: string): T | undefined`, `set(key: string, value: T, ttlMs?: number): void`, `clear(): void`.
  - From `@/lib/stats/fixture-stats`:
    - `buildForm(fixtures: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; kickoff: Date }[], teamName: string): Array<{ result: "W" | "D" | "L"; opponent: string; score: string; date: string }>`
    - `computeSummary(homeForm, awayForm, h2h): { homeWinPct: number; drawPct: number; awayWinPct: number }`
    - `fetchTeamLast5(teamId: number): Promise<NormalizedFixture[]>` and `fetchH2H(homeId: number, awayId: number): Promise<NormalizedFixture[]>` (new adapter exports).

- [ ] **Step 1: Write the failing cache tests**

Create `tests/stats-cache.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TTLCache } from "@/lib/stats/memo";

describe("TTLCache", () => {
  beforeEach(() => vi.useFakeTimers());

  it("returns undefined for a missing key", () => {
    const c = new TTLCache<number>();
    expect(c.get("nope")).toBeUndefined();
  });

  it("returns the value before TTL expiry", () => {
    const c = new TTLCache<string>(15 * 60 * 1000);
    c.set("a", "hello");
    vi.advanceTimersByTime(15 * 60 * 1000 - 1);
    expect(c.get("a")).toBe("hello");
  });

  it("expires after TTL", () => {
    const c = new TTLCache<string>(15 * 60 * 1000);
    c.set("a", "hello");
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(c.get("a")).toBeUndefined();
  });

  it("supports per-set TTL override", () => {
    const c = new TTLCache<string>(15 * 60 * 1000);
    c.set("a", "hello", 1000);
    vi.advanceTimersByTime(1001);
    expect(c.get("a")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement `TTLCache`**

Create `src/lib/stats/memo.ts`:

```ts
/** Minimal in-memory TTL cache. Not shared across server processes. */
export class TTLCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private defaultTtlMs = 15 * 60 * 1000) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
  }

  clear(): void {
    this.store.clear();
  }
}
```

- [ ] **Step 3: Run cache tests**

Run: `npx vitest run tests/stats-cache.test.ts`
Expected: 4 PASS.

- [ ] **Step 4: Write the failing stats-builder tests**

Create `tests/fixture-stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildForm, computeSummary } from "@/lib/stats/fixture-stats";

const mk = (home: string, away: string, hs: number, as_: number, daysAgo: number) => ({
  homeTeam: home,
  awayTeam: away,
  homeScore: hs,
  awayScore: as_,
  kickoff: new Date(Date.now() - daysAgo * 86_400_000),
});

describe("buildForm", () => {
  it("maps recent fixtures to W/D/L for the given team", () => {
    const rows = [
      mk("Real Madrid", "Barcelona", 2, 0, 1),
      mk("Sevilla", "Real Madrid", 1, 1, 2),
      mk("Real Madrid", "Getafe", 0, 1, 3),
    ];
    const form = buildForm(rows, "Real Madrid");
    expect(form.map((f) => f.result)).toEqual(["W", "D", "L"]);
    expect(form[0].opponent).toBe("Barcelona");
    expect(form[0].score).toBe("2 - 0");
  });

  it("returns an empty array for an unknown team", () => {
    expect(buildForm([], "Nobody")).toEqual([]);
  });
});

describe("computeSummary", () => {
  it("computes win/draw/loss percentages from forms", () => {
    const home = [{ result: "W" }, { result: "W" }, { result: "D" }, { result: "L" }, { result: "W" }] as { result: "W" | "D" | "L" }[];
    const away = [{ result: "L" }, { result: "L" }, { result: "D" }, { result: "W" }, { result: "L" }] as { result: "W" | "D" | "L" }[];
    const s = computeSummary(home as any, away as any, []);
    expect(s.homeWinPct).toBe(60);
    expect(s.drawPct).toBe(20);
    expect(s.awayWinPct).toBe(20);
  });

  it("handles empty forms with zeros", () => {
    const s = computeSummary([], [], []);
    expect(s).toEqual({ homeWinPct: 0, drawPct: 0, awayWinPct: 0 });
  });
});
```

- [ ] **Step 5: Implement `fixture-stats.ts`**

Create `src/lib/stats/fixture-stats.ts`:

```ts
export type FormResult = "W" | "D" | "L";

export interface FormEntry {
  result: FormResult;
  opponent: string;
  score: string;
  date: string;
}

export interface StatsSummary {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
}

interface FormRow {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  kickoff: Date;
}

function outcome(row: FormRow, teamName: string): FormResult | null {
  const isHome = row.homeTeam === teamName;
  const isAway = row.awayTeam === teamName;
  if (!isHome && !isAway) return null;
  const gd = isHome ? row.homeScore - row.awayScore : row.awayScore - row.homeScore;
  if (gd > 0) return "W";
  if (gd < 0) return "L";
  return "D";
}

/** Last-5 form guide entries for one team, most recent first. */
export function buildForm(rows: FormRow[], teamName: string): FormEntry[] {
  return rows
    .map((r) => ({
      r,
      result: outcome(r, teamName),
    }))
    .filter((x): x is { r: FormRow; result: FormResult } => x.result !== null)
    .sort((a, b) => b.r.kickoff.getTime() - a.r.kickoff.getTime())
    .slice(0, 5)
    .map((x) => ({
      result: x.result,
      opponent: x.r.homeTeam === teamName ? x.r.awayTeam : x.r.homeTeam,
      score: `${x.r.homeScore} - ${x.r.awayScore}`,
      date: x.r.kickoff.toISOString(),
    }));
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

/** Win/draw/loss split based on both teams' form (5 matches each). */
export function computeSummary(
  homeForm: { result: FormResult }[],
  awayForm: { result: FormResult }[],
  _h2h: unknown[],
): StatsSummary {
  const homeWins = homeForm.filter((f) => f.result === "W").length;
  const draws = homeForm.filter((f) => f.result === "D").length + awayForm.filter((f) => f.result === "D").length;
  const awayWins = awayForm.filter((f) => f.result === "W").length;
  const total = homeForm.length + awayForm.length;
  return { homeWinPct: pct(homeWins, total), drawPct: pct(draws, total), awayWinPct: pct(awayWins, total) };
}
```

- [ ] **Step 6: Run builder tests**

Run: `npx vitest run tests/fixture-stats.test.ts`
Expected: 4 PASS.

- [ ] **Step 7: Add adapter exports for last-5 and H2H**

In `src/server/adapters/api-football.ts`, add at the end (reusing the private `call`):

```ts
/** A team's last N fixtures (1 request). */
export async function getTeamLastN(teamId: number, last = 5): Promise<NormalizedFixture[]> {
  const raw = await call(`/fixtures?team=${teamId}&last=${last}`);
  return raw.map(mapFixture);
}

/** Head-to-head between two teams (1 request). */
export async function getH2H(homeId: number, awayId: number): Promise<NormalizedFixture[]> {
  const raw = await call(`/fixtures?h2h=${homeId}-${awayId}`);
  return raw.map(mapFixture);
}
```

- [ ] **Step 8: Implement the stats route**

Create `src/app/api/fixtures/[id]/stats/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { isConfigured, getTeamLastN, getH2H } from "@/server/adapters/api-football";
import { TTLCache } from "@/lib/stats/memo";
import { buildForm, computeSummary } from "@/lib/stats/fixture-stats";

const cache = new TTLCache<StatsPayload>(15 * 60 * 1000);

interface StatsPayload {
  homeForm: { result: "W" | "D" | "L"; opponent: string; score: string; date: string }[];
  awayForm: { result: "W" | "D" | "L"; opponent: string; score: string; date: string }[];
  h2h: { homeTeam: string; awayTeam: string; score: string; date: string }[];
  statsSummary: { homeWinPct: number; drawPct: number; awayWinPct: number };
  source: "api" | "db";
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cached = cache.get(id);
  if (cached) return NextResponse.json(cached);

  const fixture = await prisma.fixture.findUnique({ where: { id } });
  if (!fixture) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });

  let payload: StatsPayload | null = null;
  if (isConfigured() && fixture.homeTeamId && fixture.awayTeamId) {
    try {
      const [homeRaw, awayRaw, h2hRaw] = await Promise.all([
        getTeamLastN(fixture.homeTeamId),
        getTeamLastN(fixture.awayTeamId),
        getH2H(fixture.homeTeamId, fixture.awayTeamId),
      ]);
      const toRows = (raw: typeof homeRaw) =>
        raw.map((f) => ({
          homeTeam: f.homeTeam,
          awayTeam: f.awayTeam,
          homeScore: f.homeScore,
          awayScore: f.awayScore,
          kickoff: f.kickoff,
        }));
      const homeForm = buildForm(toRows(homeRaw), fixture.homeTeam);
      const awayForm = buildForm(toRows(awayRaw), fixture.awayTeam);
      const h2h = h2hRaw.slice(0, 5).map((f) => ({
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        score: `${f.homeScore} - ${f.awayScore}`,
        date: f.kickoff.toISOString(),
      }));
      payload = {
        homeForm,
        awayForm,
        h2h,
        statsSummary: computeSummary(homeForm, awayForm, h2h),
        source: "api",
      };
    } catch {
      payload = null; // fall through to DB fallback
    }
  }

  if (!payload) {
    const rows = await prisma.fixture.findMany({
      where: {
        status: "FINISHED",
        OR: [{ homeTeam: fixture.homeTeam }, { awayTeam: fixture.homeTeam }],
      },
      orderBy: { kickoff: "desc" },
      take: 5,
    });
    const rowsAway = await prisma.fixture.findMany({
      where: {
        status: "FINISHED",
        OR: [{ homeTeam: fixture.awayTeam }, { awayTeam: fixture.awayTeam }],
      },
      orderBy: { kickoff: "desc" },
      take: 5,
    });
    const mkRows = (f: typeof rows[number]) => ({
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      kickoff: f.kickoff,
    });
    const homeForm = buildForm(rows.map(mkRows), fixture.homeTeam);
    const awayForm = buildForm(rowsAway.map(mkRows), fixture.awayTeam);
    payload = {
      homeForm,
      awayForm,
      h2h: [],
      statsSummary: computeSummary(homeForm, awayForm, []),
      source: "db",
    };
  }

  cache.set(id, payload);
  return NextResponse.json(payload);
}
```

Note: the prisma singleton is at `@/lib/db` (used by `src/app/api/fixtures/[id]/route.ts`, `src/server/scheduler/odds.ts`, etc.) — import `{ prisma } from "@/lib/db"`.

- [ ] **Step 9: Verify + commit**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build && node scripts/smoke.mjs`
Expected: all pass.

```bash
git add src/lib/stats tests/stats-cache.test.ts tests/fixture-stats.test.ts src/server/adapters/api-football.ts "src/app/api/fixtures/[id]/stats/route.ts"
git commit -m "feat(api): fixture stats endpoint with ttl cache and db fallback"
```

---

### Task 6: Statistiques tab — sub-nav + `FixtureStats` component

**Files:**
- Create: `src/components/fixture/FixtureStats.tsx`
- Modify: `src/app/fixture/[id]/page.tsx` (sub-nav tabs; move lineups section under "Composition")

**Interfaces:**
- Consumes: `api` from `@/lib/client/api`, `StatsPayload` shape from Task 5 route (via `api.get<StatsPayload>`), `TeamCrest`, `FixtureRow`.
- Produces: `FixtureStats({ fixtureId }: { fixtureId: string })` client component; page state `activeTab: "marches" | "stats" | "composition"` (Task 8 adds "communauté").

- [ ] **Step 1: Create `FixtureStats`**

Create `src/components/fixture/FixtureStats.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

interface StatsPayload {
  homeForm: { result: "W" | "D" | "L"; opponent: string; score: string; date: string }[];
  awayForm: { result: "W" | "D" | "L"; opponent: string; score: string; date: string }[];
  h2h: { homeTeam: string; awayTeam: string; score: string; date: string }[];
  statsSummary: { homeWinPct: number; drawPct: number; awayWinPct: number };
  source: "api" | "db";
}

const RESULT_STYLE: Record<"W" | "D" | "L", string> = {
  W: "bg-emerald-500/20 text-emerald-400",
  D: "bg-surface-3 text-text-secondary",
  L: "bg-red-500/20 text-red-400",
};

function FormRow({ entries }: { entries: StatsPayload["homeForm"] }) {
  return (
    <div className="flex gap-1">
      {entries.length === 0 && <span className="text-[11px] text-text-tertiary">No recent matches</span>}
      {entries.map((e, i) => (
        <span key={i} className="flex h-5 w-5 items-center justify-center rounded bg-surface-2 text-[10px] font-bold text-text-secondary">
          {e.result}
        </span>
      ))}
    </div>
  );
}

export function FixtureStats({ fixtureId, homeTeam, awayTeam }: { fixtureId: string; homeTeam: string; awayTeam: string }) {
  const [data, setData] = useState<StatsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<StatsPayload>(`/api/fixtures/${fixtureId}/stats`).then((res) => {
      if (!cancelled && res.ok) setData(res.data!);
    });
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  if (!data) {
    return <div className="animate-pulse rounded-xl border border-card-border bg-card-dark p-4 text-sm text-text-tertiary">Chargement des statistiques…</div>;
  }

  return (
    <div className="space-y-3">
      {/* Form guide */}
      <div className="rounded-xl border border-card-border bg-card-dark p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-betclic-gold">Forme des équipes</h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold">{homeTeam}</span>
            <FormRow entries={data.homeForm} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold">{awayTeam}</span>
            <FormRow entries={data.awayForm} />
          </div>
        </div>
      </div>

      {/* H2H */}
      <div className="rounded-xl border border-card-border bg-card-dark p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-betclic-gold">Face à face</h3>
        {data.h2h.length === 0 ? (
          <p className="text-[11px] text-text-tertiary">No head-to-head data</p>
        ) : (
          <ul className="space-y-2">
            {data.h2h.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{m.homeTeam}</span>
                <span className="shrink-0 rounded-lg bg-bg px-2.5 py-1 font-bold tabular-nums text-betclic-gold">{m.score}</span>
                <span className="min-w-0 flex-1 truncate text-right">{m.awayTeam}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-card-border bg-card-dark p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-betclic-gold">Répartition des résultats</h3>
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="bg-betclic-gold" style={{ width: `${data.statsSummary.homeWinPct}%` }} />
          <div className="bg-surface-3" style={{ width: `${data.statsSummary.drawPct}%` }} />
          <div className="bg-betclic-red" style={{ width: `${data.statsSummary.awayWinPct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold text-text-tertiary">
          <span className="text-betclic-gold">{data.statsSummary.homeWinPct}% domicile</span>
          <span>{data.statsSummary.drawPct}% nul</span>
          <span className="text-betclic-red">{data.statsSummary.awayWinPct}% extérieur</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add sub-nav tabs to the fixture page**

In `src/app/fixture/[id]/page.tsx`:
1. Add state next to `openPanel`:
   ```ts
   const [activeTab, setActiveTab] = useState<"marches" | "stats" | "composition">("marches");
   ```
2. Import `FixtureStats`:
   ```ts
   import { FixtureStats } from "@/components/fixture/FixtureStats";
   ```
3. Insert the tab bar right after `<ScoreBoard fixture={fixture} />` (and before the team-crests block):

```tsx
      {/* Betclic sub-nav */}
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {([
          { key: "marches", label: "Marchés" },
          { key: "stats", label: "Statistiques" },
          { key: "composition", label: "Composition" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors",
              activeTab === t.key
                ? "bg-betclic-gold text-black"
                : "border border-card-border bg-card-dark text-text-secondary hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
```

   Add the `cn` import if missing: `import { cn } from "@/lib/client/cn";`

4. Wrap the markets block (`<div className="mt-4 space-y-2">…markets…</div>`) in `{activeTab === "marches" && ( … )}`.
5. Add after the markets block:

```tsx
      {activeTab === "stats" && (
        <div className="mt-4">
          <FixtureStats fixtureId={fixture.id} homeTeam={fixture.homeTeam} awayTeam={fixture.awayTeam} />
        </div>
      )}
```

6. Wrap the existing lineups section in `{activeTab === "composition" && ( … )}` (keep the same markup).

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build && node scripts/smoke.mjs`
Expected: all pass.

```bash
git add src/components/fixture/FixtureStats.tsx "src/app/fixture/[id]/page.tsx"
git commit -m "feat(ui): statistiques tab with form, h2h and result split"
```

---

### Task 7: `/api/community` route + win-rate ranking lib

**Files:**
- Create: `src/lib/community/rank.ts`
- Create: `src/app/api/community/route.ts`
- Create: `tests/community-rank.test.ts`

**Interfaces:**
- Consumes: `prisma` client, `Bet`/`BetLeg`/`User` models, `isBot` flag.
- Produces:
  - `rankBettors(rows: { userId: string; username: string; isBot: boolean; won: boolean }[], minSettled = 3)` from `@/lib/community/rank` → `Array<{ username: string; isBot: boolean; settled: number; won: number; winRate: number }>` sorted desc, max 10.
  - `GET /api/community?tab=feed|top&period=today|week&fixtureId=...`.

- [ ] **Step 1: Write the failing ranking tests**

Create `tests/community-rank.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rankBettors } from "@/lib/community/rank";

const rows = [
  { userId: "a", username: "A", isBot: false, won: true },
  { userId: "a", username: "A", isBot: false, won: false },
  { userId: "a", username: "A", isBot: false, won: true },
  { userId: "b", username: "B", isBot: false, won: true },
  { userId: "c", username: "C", isBot: true, won: true },
  { userId: "c", username: "C", isBot: true, won: false },
  { userId: "d", username: "D", isBot: false, won: false },
];

describe("rankBettors", () => {
  it("ranks by win rate with minimum 3 settled bets", () => {
    const ranked = rankBettors(rows);
    expect(ranked.map((r) => r.username)).toEqual(["A", "C"]);
    expect(ranked[0]).toMatchObject({ settled: 3, won: 2, winRate: 66 });
  });

  it("includes bots in the ranking", () => {
    expect(rankBettors(rows).some((r) => r.isBot)).toBe(true);
  });

  it("excludes bettors below the minimum settled threshold", () => {
    const ranked = rankBettors(rows, 3);
    expect(ranked.every((r) => r.settled >= 3)).toBe(true);
  });

  it("returns empty for no rows", () => {
    expect(rankBettors([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/community-rank.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `rank.ts`**

Create `src/lib/community/rank.ts`:

```ts
export interface RankRow {
  userId: string;
  username: string;
  isBot: boolean;
  won: boolean;
}

export interface RankedBettor {
  username: string;
  isBot: boolean;
  settled: number;
  won: number;
  winRate: number;
}

/** Group by user, keep only those with >= minSettled settled bets, sort by win rate desc, take 10. */
export function rankBettors(rows: RankRow[], minSettled = 3): RankedBettor[] {
  const byUser = new Map<string, { username: string; isBot: boolean; settled: number; won: number }>();
  for (const r of rows) {
    const acc = byUser.get(r.userId) ?? { username: r.username, isBot: r.isBot, settled: 0, won: 0 };
    acc.settled += 1;
    if (r.won) acc.won += 1;
    byUser.set(r.userId, acc);
  }
  return [...byUser.values()]
    .filter((u) => u.settled >= minSettled)
    .map((u) => ({ ...u, winRate: Math.round((u.won / u.settled) * 100) }))
    .sort((a, b) => b.winRate - a.winRate || b.settled - a.settled)
    .slice(0, 10);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/community-rank.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Implement the community route**

Create `src/app/api/community/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { rankBettors } from "@/lib/community/rank";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tab = params.get("tab") ?? "feed";

  if (tab === "top") {
    const period = params.get("period") ?? "week";
    const since =
      period === "today" ? new Date(new Date().setHours(0, 0, 0, 0)) : new Date(Date.now() - 7 * 86_400_000);
    const bets = await prisma.bet.findMany({
      where: { status: { in: ["WON", "LOST"] }, placedAt: { gte: since } },
      select: { userId: true, user: { select: { username: true, isBot: true } }, status: true },
    });
    const rows = bets.map((b) => ({
      userId: b.userId,
      username: b.user.username,
      isBot: b.user.isBot,
      won: b.status === "WON",
    }));
    return NextResponse.json({ top: rankBettors(rows) });
  }

  // tab=feed
  const fixtureId = params.get("fixtureId");
  const bets = await prisma.bet.findMany({
    where: fixtureId ? { legs: { some: { fixtureId } } } : {},
    orderBy: { placedAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      stakeTotal: true,
      potentialReturn: true,
      payout: true,
      status: true,
      placedAt: true,
      user: { select: { username: true, isBot: true } },
      legs: {
        select: {
          fixtureId: true,
          marketKey: true,
          selectionKey: true,
          selectionName: true,
          oddsLocked: true,
          fixture: { select: { homeTeam: true, awayTeam: true, kickoff: true } },
        },
      },
    },
  });
  return NextResponse.json({
    bets: bets.map((b) => ({
      id: b.id,
      type: b.type,
      stakeTotal: b.stakeTotal,
      potentialReturn: Number(b.potentialReturn),
      payout: b.payout,
      status: b.status,
      placedAt: b.placedAt,
      username: b.user.username,
      isBot: b.user.isBot,
      legs: b.legs.map((l) => ({
        fixtureId: l.fixtureId,
        marketKey: l.marketKey,
        selectionKey: l.selectionKey,
        selectionName: l.selectionName,
        odds: Number(l.oddsLocked),
        label: `${l.fixture.homeTeam} vs ${l.fixture.awayTeam}`,
      })),
    })),
  });
}
```

Note: verify the prisma singleton import path — it is `import { prisma } from "@/lib/db"` (as used in `src/app/api/fixtures/[id]/route.ts`).

- [ ] **Step 6: Verify + commit**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build && node scripts/smoke.mjs`
Expected: all pass.

```bash
git add src/lib/community/rank.ts tests/community-rank.test.ts src/app/api/community/route.ts
git commit -m "feat(api): community feed and top bettors endpoints"
```

---

### Task 8: Community UI — page, fixture tab, copy-bet, nav links

**Files:**
- Create: `src/app/community/page.tsx`
- Create: `src/components/community/BetFeedCard.tsx`
- Create: `src/components/community/CopyBetButton.tsx`
- Create: `src/components/fixture/FixtureCommunity.tsx`
- Modify: `src/app/fixture/[id]/page.tsx` (add "communauté" tab)
- Modify: `src/components/layout/MobileNav.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Sidebar.tsx` (add Communauté link)

**Interfaces:**
- Consumes: `api` from `@/lib/client/api`, `useSlip` from `@/stores/slip` (`add(sel)`, `open()`), `formatEuro` from `@/lib/client/format`, community route JSON from Task 7, `FixtureRow`.
- Produces: `/community` page; `BetFeedCard({ bet }: { bet: CommunityBet })`; `CopyBetButton({ legs, fixtureLabel }: { legs: { fixtureId: string; marketKey: string; selectionKey: string; selectionName: string; odds: number; label: string }[] })`; `FixtureCommunity({ fixtureId, homeTeam, awayTeam })`.

- [ ] **Step 1: Create `CopyBetButton`**

Create `src/components/community/CopyBetButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useSlip, type Selection } from "@/stores/slip";

export interface CopyableLeg {
  fixtureId: string;
  marketKey: string;
  selectionKey: string;
  selectionName: string;
  odds: number;
  label: string;
}

export function CopyBetButton({ legs }: { legs: CopyableLeg[] }) {
  const [copied, setCopied] = useState(false);
  const add = useSlip((s) => s.add);
  const open = useSlip((s) => s.open);

  const handle = () => {
    legs.forEach((leg) => {
      const sel: Selection = {
        fixtureId: leg.fixtureId,
        marketKey: leg.marketKey,
        selectionKey: leg.selectionKey,
        selectionName: leg.selectionName,
        fixtureLabel: leg.label,
        odds: leg.odds,
      };
      add(sel);
    });
    open();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handle}
      className="flex items-center gap-1.5 rounded-lg bg-betclic-gold px-3 py-1.5 text-[11px] font-bold text-black transition-colors hover:bg-betclic-gold-hover"
    >
      <Copy size={12} />
      {copied ? "Copié !" : "Copier le pari"}
    </button>
  );
}
```

- [ ] **Step 2: Create `BetFeedCard`**

Create `src/components/community/BetFeedCard.tsx`:

```tsx
"use client";

import { formatEuro } from "@/lib/client/format";
import { CopyBetButton, type CopyableLeg } from "./CopyBetButton";

export interface CommunityBet {
  id: string;
  type: string;
  stakeTotal: number;
  potentialReturn: number;
  payout: number;
  status: string;
  placedAt: string;
  username: string;
  isBot: boolean;
  legs: CopyableLeg[];
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-surface-3 text-text-secondary",
  WON: "bg-emerald-500/20 text-emerald-400",
  LOST: "bg-red-500/20 text-red-400",
  VOID: "bg-surface-3 text-text-secondary",
};

export function BetFeedCard({ bet }: { bet: CommunityBet }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-dark p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-text-secondary">
            {bet.username.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">
              {bet.username}
              {bet.isBot && <span className="ml-1.5 rounded bg-surface-3 px-1 py-0.5 text-[8px] font-bold uppercase text-text-tertiary">Bot</span>}
            </p>
            <p className="text-[10px] text-text-tertiary">{new Date(bet.placedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[bet.status] ?? "bg-surface-3"}`}>
          {bet.status}
        </span>
      </div>

      <ul className="space-y-1">
        {bet.legs.map((leg, i) => (
          <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-2.5 py-1.5 text-[11px]">
            <span className="min-w-0 flex-1 truncate text-text-secondary">{leg.label}</span>
            <span className="shrink-0 truncate font-semibold">{leg.selectionName}</span>
            <span className="shrink-0 font-bold tabular-nums text-betclic-gold">{leg.odds.toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-text-tertiary">
          Mise <span className="font-bold text-text-primary">{formatEuro(bet.stakeTotal)}</span>
          {bet.potentialReturn > 0 && (
            <>
              {" · "}Gain potentiel <span className="font-bold text-betclic-gold">{formatEuro(bet.potentialReturn)}</span>
            </>
          )}
        </p>
        {bet.status === "OPEN" && <CopyBetButton legs={bet.legs} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the `/community` page**

Create `src/app/community/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/client/api";
import { BetFeedCard, type CommunityBet } from "@/components/community/BetFeedCard";
import { cn } from "@/lib/client/cn";

interface TopBettor {
  username: string;
  isBot: boolean;
  settled: number;
  won: number;
  winRate: number;
}

export default function CommunityPage() {
  const [tab, setTab] = useState<"feed" | "top">("feed");
  const [period, setPeriod] = useState<"today" | "week">("week");
  const [bets, setBets] = useState<CommunityBet[] | null>(null);
  const [top, setTop] = useState<TopBettor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (tab === "feed") {
      api.get<{ bets: CommunityBet[] }>("/api/community?tab=feed").then((res) => {
        if (!cancelled && res.ok) setBets(res.data!.bets);
      });
    } else {
      api.get<{ top: TopBettor[] }>(`/api/community?tab=top&period=${period}`).then((res) => {
        if (!cancelled && res.ok) setTop(res.data!.top);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [tab, period]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="sticky top-0 z-20 -mx-3 mb-3 flex items-center gap-2 border-b border-card-border bg-bg/90 px-3 py-2 backdrop-blur lg:-mx-6 lg:px-6">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("feed")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                tab === "feed" ? "bg-betclic-gold text-black" : "border border-card-border bg-card-dark text-text-secondary hover:text-white",
              )}
            >
              <Users size={13} />
              Public
            </button>
            <button
              onClick={() => setTab("top")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                tab === "top" ? "bg-betclic-gold text-black" : "border border-card-border bg-card-dark text-text-secondary hover:text-white",
              )}
            >
              <Trophy size={13} />
              Top parieurs
            </button>
          </div>
          {tab === "top" && (
            <div className="ml-auto flex gap-1">
              {(["today", "week"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase transition-colors",
                    period === p ? "bg-betclic-gold text-black" : "text-text-tertiary hover:text-white",
                  )}
                >
                  {p === "today" ? "Aujourd'hui" : "Cette semaine"}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === "feed" && (
          <div className="space-y-2">
            {bets === null && <p className="py-10 text-center text-sm text-text-tertiary">Loading…</p>}
            {bets?.length === 0 && <p className="py-10 text-center text-sm text-text-tertiary">No public bets yet</p>}
            {bets?.map((b) => <BetFeedCard key={b.id} bet={b} />)}
          </div>
        )}

        {tab === "top" && (
          <div className="space-y-2">
            {top === null && <p className="py-10 text-center text-sm text-text-tertiary">Loading…</p>}
            {top?.map((t, i) => (
              <div key={t.username} className="flex items-center justify-between gap-3 rounded-xl border border-card-border bg-card-dark px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black",
                    i === 0 ? "bg-betclic-gold text-black" : "bg-surface-3 text-text-secondary",
                  )}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {t.username}
                      {t.isBot && <span className="ml-1.5 rounded bg-surface-3 px-1 py-0.5 text-[8px] font-bold uppercase text-text-tertiary">Bot</span>}
                    </p>
                    <p className="text-[10px] text-text-tertiary">
                      {t.settled} paris · {t.won} gagnés
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-lg font-black tabular-nums text-betclic-gold">{t.winRate}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Add the Communauté tab to the fixture page**

In `src/app/fixture/[id]/page.tsx`:
1. Extend the tab union: `useState<"marches" | "stats" | "composition" | "communaute">("marches")`.
2. Add to the tabs array: `{ key: "communaute", label: "Communauté" }`.
3. Import and render:

```tsx
import { FixtureCommunity } from "@/components/fixture/FixtureCommunity";
...
      {activeTab === "communaute" && (
        <div className="mt-4">
          <FixtureCommunity fixtureId={fixture.id} />
        </div>
      )}
```

- [ ] **Step 5: Create `FixtureCommunity`**

Create `src/components/fixture/FixtureCommunity.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { BetFeedCard, type CommunityBet } from "@/components/community/BetFeedCard";

export function FixtureCommunity({ fixtureId }: { fixtureId: string }) {
  const [bets, setBets] = useState<CommunityBet[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<{ bets: CommunityBet[] }>(`/api/community?tab=feed&fixtureId=${fixtureId}`).then((res) => {
      if (!cancelled && res.ok) setBets(res.data!.bets);
    });
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  if (bets === null) {
    return <p className="py-6 text-center text-sm text-text-tertiary">Loading…</p>;
  }
  if (bets.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card-dark p-6 text-center">
        <p className="text-sm text-text-tertiary">No public bets on this match yet.</p>
      </div>
    );
  }
  return <div className="space-y-2">{bets.map((b) => <BetFeedCard key={b.id} bet={b} />)}</div>;
}
```

- [ ] **Step 6: Add the nav link**

Read `src/components/layout/MobileNav.tsx`, `Header.tsx`, and `Sidebar.tsx`; each renders a list of nav items (e.g. `/`, `/live`, `/my-bets`, `/leaderboard`, `/profile`, `/friends`). Add a **Communauté** item with `href="/community"` (icon: `Users` from lucide-react) in the same position in all three (after `/leaderboard` if present, else at the end). Match the existing item markup exactly per file.

- [ ] **Step 7: Verify + commit**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build && node scripts/smoke.mjs`
Expected: all pass.

```bash
git add src/app/community/page.tsx src/components/community src/components/fixture/FixtureCommunity.tsx "src/app/fixture/[id]/page.tsx" src/components/layout
git commit -m "feat(ui): community tab with public feed, top bettors and copy bet"
```

---

### Task 9: Backfill team ids for existing fixtures + RESUME + docs

**Files:**
- Modify: `src/server/scheduler/fixtures.ts` (backfill function)
- Modify: `server.ts` (call backfill at boot)
- Modify: `RESUME.md`
- Modify: `docs/superpowers/specs/2026-08-15-scorer-stats-community-betclic-style-design.md` (mark status Approved → Implemented at the end)

**Interfaces:**
- Consumes: `refreshLineups` (Task 4).
- Produces: `backfillTeamIds()` exported from `fixtures.ts`; called once at boot after `refreshFixtures`.

- [ ] **Step 1: Add `backfillTeamIds` to `fixtures.ts`**

Append to `src/server/scheduler/fixtures.ts`:

```ts
/** One-time backfill: store API team ids on existing api-football fixtures (max 10, 1 request each). */
export async function backfillTeamIds(): Promise<void> {
  const fixtures = await prisma.fixture.findMany({
    where: { homeTeamId: null, providerId: { not: { startsWith: "fd:" } } },
    select: { id: true, providerId: true },
    take: 10,
  });
  let changed = 0;
  for (const f of fixtures) {
    const raw = await apiFootball.getFixturesByProviderId(f.providerId);
    if (!raw?.homeTeamId || !raw?.awayTeamId) continue;
    await prisma.fixture.update({
      where: { id: f.id },
      data: { homeTeamId: raw.homeTeamId, awayTeamId: raw.awayTeamId },
    });
    changed++;
  }
  if (changed > 0) console.log(`[fixtures] backfilled team ids for ${changed} fixtures`);
}
```

This requires a helper `getFixturesByProviderId` in the adapter:

```ts
/** Single fixture by provider id (1 request). */
export async function getFixturesByProviderId(providerId: string): Promise<NormalizedFixture | null> {
  const raw = await call(`/fixtures?id=${providerId}`);
  const first = raw[0];
  return first ? mapFixture(first) : null;
}
```

- [ ] **Step 2: Call at boot**

In `server.ts`, after the `cleanupDuplicateFixtures()` call (line ~55), add:

```ts
  await backfillTeamIds().catch(() => undefined);
```

and update the import from `fixtures.ts` to include `backfillTeamIds`.

- [ ] **Step 3: Update RESUME.md + spec status**

- Update `RESUME.md`: mark this feature Implemented, list the 9 tasks, note the restart command and tunnel.
- In the spec doc, change `Status: Approved by user` → `Status: Implemented`.

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build && node scripts/smoke.mjs`
Expected: all pass.

```bash
git add src/server/scheduler/fixtures.ts src/server/adapters/api-football.ts server.ts RESUME.md docs/superpowers/specs/2026-08-15-scorer-stats-community-betclic-style-design.md
git commit -m "chore: backfill team ids, update docs"
```

---

## Self-Review

- **Spec coverage:** Task 1 (Betclic gold cards/buttons), Task 2 (scoreboard + market panels), Task 3 (scorer hidden without lineups — no fake names), Task 4 (team ids + 15-min lineup refresh), Task 5 (stats endpoint, 15-min cache, DB fallback), Task 6 (Statistiques tab with form/H2H/summary), Task 7 (community feed + top bettors by win rate, min 3 settled, bots included), Task 8 (Community page, fixture Community tab, copy-bet, nav links), Task 9 (backfill + docs). Spec's "Composition" tab is satisfied by moving the existing lineups section under it (Task 6 step 2.6); spec's formation display on the pitch is covered by the existing `PitchVisualizer`/lineup UI which remains.
- **Placeholders:** none — every step has concrete code or an exact command.
- **Type consistency:** `TTLCache<T>` (get/set/clear) used identically in memo.ts and the route; `buildForm`/`computeSummary` signatures match between fixture-stats.ts and both test files and the route; `rankBettors` signature matches rank.ts, tests, and route; `CopyableLeg` reused by BetFeedCard, CopyBetButton, and FixtureCommunity; route param names (`tab`, `period`, `fixtureId`) consistent between routes and clients.
