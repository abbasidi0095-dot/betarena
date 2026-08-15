# BetArena — Fixed Fallback Odds + Big-League Sorting

Date: 2026-08-15
Status: Approved by user

## Problem

The Odds API only covers the top-6 leagues. Today ~2023 of ~2042 scheduled fixtures
have no odds at all, so the feed shows a dead "Odds coming soon" state on almost
every card and those matches cannot be bet on.

Users want:
1. All matches remain in the feed (already true).
2. Big leagues sort to the top of the feed.
3. Every match without real odds gets fixed, deterministic odds that never change
   across refreshes — covering 1X2, Over/Under 2.5, and BTTS ("all bets").

## Approach

Backfill deterministic fallback odds into the database for any scheduled fixture
that lacks a real h2h market. Real odds from The Odds API are never overwritten.
"Big leagues first" is implemented with a `priority` column on `League`.

Chosen over read-time synthesis (breaks placement validation) and flat per-league
constants (looks fake, rejected by user).

## Design

### 1. Deterministic generator — `src/lib/betting/fallback-odds.ts`

Pure module, no DB access.

- `fallbackOdds(fixture: { id: string; homeTeam: string; awayTeam: string })`
  returns:
  ```
  {
    h2h:    { home, draw, away },
    totals: { over_2.5, under_2.5 },
    btts:   { btts_yes, btts_no }
  }
  ```
- Values derived from a seeded hash (fixture id + team names) so the same fixture
  always produces the same odds across refreshes and restarts.
- Realistic decimal ranges:
  - home/away: 1.85 – 3.50
  - draw: 2.90 – 3.70
  - over/under 2.5: 1.75 – 2.15
  - BTTS yes/no: 1.65 – 2.30
- Totals and BTTS implied probabilities are derived from the seeded 1X2 using the
  same style of fair-odds + margin math already present in
  `src/lib/betting/odds-model.ts`, so the three markets are internally consistent.
- Export `isFallbackOddsRow`-style helper if useful for tests only.

### 2. Boot backfill — `src/server/scheduler/odds.ts`

New exported function `backfillFallbackOdds(io?)`:

1. Query SCHEDULED fixtures with `markets: { none: { key: "h2h" } }` (select id,
   homeTeam, awayTeam).
2. For each, compute `fallbackOdds(fixture)` and upsert:
   - `Market` rows keyed `h2h`, `totals`, `btts` (status OPEN)
   - `Odds` rows keyed by selectionKey (`home|draw|away`, `over_2.5|under_2.5`,
     `btts_yes|btts_no`) with the computed values
   - Upsert skips when the value is unchanged (delta < 0.005), mirroring
     `upsertOddsForFixtures` in the same file.
3. Emit `odds:update` via io like the real-odds path so any connected client
   sees the new market appear.
4. Called:
   - at server boot (after fixture refresh, before serving)
   - after each `refreshFixtures()` / `week` sync in the scheduler loop
   - only processes fixtures missing odds, so repeated runs are cheap.

Real odds are untouched: the query only targets fixtures with no h2h market, and
an h2h market existing at all (even one selection) marks the fixture as "has real
odds" — fallback stops applying there.

### 3. Big-league priority

- Prisma migration: add `League.priority Int @default(0)`.
- Priority map (API-Football league ids):
  - 1 (top tier): EPL (39), La Liga (140), Serie A (135), Bundesliga (78),
    Ligue 1 (61), Champions League (2)
  - 2 (second tier): Europa League (3), Eredivisie (88), Primeira Liga (94),
    Süper Lig (203), Belgian First Division A (144)
  - 0 (default): everything else
- Set/update `priority` during league upsert in `src/server/scheduler/fixtures.ts`
  and `src/server/scheduler/week.ts` (and the standings stub creation path in
  `fixtures.ts` so stubs also carry priority).
- Feed ordering in `src/app/api/fixtures/route.ts` becomes:
  `orderBy: [{ league: { priority: "asc" } }, { status: "desc" }, { kickoff: "asc" }]`.
  All matches remain; big leagues sort first.
- `/api/leagues` and league pages may surface `priority` but no UI changes are
  required for it.

### 4. UI

- The "Odds coming soon" branch in `src/components/feed/MatchCard.tsx` becomes
  effectively unreachable once backfill runs; keep it as a defensive fallback.
- Fixture detail page already renders totals/BTTS when market rows exist — no
  change needed.
- No other UI changes.

## Testing

- Unit: `fallbackOdds` determinism (same input → same output across many
  fixtures), value ranges, 1X2 sums to sensible margin (fair odds + ~5–8%),
  totals/btts consistency.
- Unit: backfill creates all 3 markets + 6 selections for a fixture without
  odds; preserves existing real odds rows on a fixture that has an h2h market
  (query excludes it); idempotent on re-run.
- E2E smoke: feed ordering returns big-league fixtures first (top-6 leagues
  before others); a previously "coming soon" fixture now renders 1X2 buttons.
- Gate commands unchanged: `npm test`, `npm run typecheck`, `npm run lint`,
  `npm run build`.

## Out of scope

- Changing The Odds API league coverage.
- Per-fixture "featured" logic beyond priority ordering.
- Any change to settlement or betting slip logic (odds rows in DB already flow
  through the standard paths).
