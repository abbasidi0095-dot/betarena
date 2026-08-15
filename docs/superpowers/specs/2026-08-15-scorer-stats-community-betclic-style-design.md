# BetArena — Betclic Match Styling, Real Scorer Names, Stats & Community Tabs

Date: 2026-08-15
Status: Approved by user

## Problem

1. **Match UI & Detail Page Styling**: The current match cards and match detail pages use generic grey styling with basic buttons, whereas users prefer the authentic Betclic mobile aesthetic: full-bleed image header cards, flag + league headers, yellow/gold odds buttons (`bg-[#FFC700]`), team form guide diamonds (green/red `◆`), league rank badges, dotted connector lines, and odds probability bars.
2. **Anytime Scorer Fake Names**: The Anytime Scorer market currently generates fake star player names when real lineups are not available. This causes invalid bets (since settlement checks real goalscorer events which match actual player names).
3. **Missing Match Stats**: Users cannot view team form, recent 5 matches, H2H record, or team formations on the fixture page.
4. **No Community Features**: Users cannot browse public bet slips placed by real users or bots, copy bets to their own slip, or view top bettor win-rate leaderboards.

## Solution & Architecture

We implement four cohesive sub-systems:

1. **Betclic Match UI & Detail Styling**: Re-skin `MatchCard.tsx`, `ScoreBoard.tsx`, sub-nav tabs, and market panels to replicate the Betclic reference UI (gold pills `#FFC700`, dark rounded cards `#181a20`, form guide diamonds, rank badges, probability indicator bars under odds, dotted lines).
2. **Accurate Anytime Scorers**: Remove fake name generation (`starPlayersFor`). Hide the Anytime Scorer market completely until real lineups are fetched from API-Football. Near-kickoff scheduler updates lineups automatically.
3. **On-Demand Match Statistics**: Store `homeTeamId` & `awayTeamId` on `Fixture`. Create `GET /api/fixtures/[id]/stats` that fetches last 5 team matches and H2H encounters from API-Football with a 15-minute in-memory cache and DB fallback. Render a rich `FixtureStats.tsx` component (Form guide, H2H, Formation).
4. **Community Tab & Bet Copy**: Create `GET /api/community` returning public bets (real + bot bets) and top bettor win-rate rankings (min 3 settled bets, today/week). Build `FixtureCommunity.tsx` (for match detail page) and `src/app/community/page.tsx` (for main nav tab `/community`) with 1-click "Copy Bet to Slip".

---

## Detailed Design

### 1. Betclic Visual Restyle

#### Theme Tokens (`src/app/globals.css`)
Add Betclic gold colors:
- `--color-betclic-gold: #FFC700`
- `--color-betclic-gold-hover: #E5B300`
- `--color-card-dark: #181a20`
- `--color-card-border: #262a34`

#### Match Card (`src/components/feed/MatchCard.tsx`)
- Card background: Full dark image backdrop (stadium / match action overlay gradient `from-black/80 via-black/60 to-[#12141a]`).
- Top header: Flag icon + Country/League text (e.g. "⚽ Japon J-League • J2"). Red live badge + timer on right if live.
- Middle: Team names in bold white (`Vissel Kobe  0 - 0  FC Tokyo` or `Séville  21:30  Rayo Vallecano`).
- Odds row: 3 bright gold buttons (`bg-[#FFC700] text-black rounded-xl font-bold hover:bg-[#E5B300]`).
  - Top text (small): Outcome label ("Vissel Kobe", "Nul", "FC Tokyo").
  - Bottom text (large bold): Odds value ("2,50", "2,80", "2,90").
  - Under each yellow button: Progress bar showing implied probability or market split (e.g., green bar for home team, red bar for draw/away).

#### ScoreBoard & Fixture Header (`src/components/fixture/ScoreBoard.tsx` & `/fixture/[id]/page.tsx`)
- Banner background: Dark hero image overlay.
- Flag + League header + Betclic TV button.
- Team names + Kickoff/Score.
- Below team names:
  - Form diamonds: Row of 5 diamonds (`◆` green for W, `◆` red for L, `◆` grey for D).
  - League rank badges: Small pill badges showing rank (e.g., `#14`, `#4`).
- Sub-nav tabs: **Marchés** | **Statistiques** | **Composition** | **Communauté** (scrollable pill tab row).

#### Market Cards & Odds Pills (`src/app/fixture/[id]/page.tsx` & Market components)
- Container cards: Dark `#181a20` rounded box with `ⓘ` title header.
- Odds button display:
  - 3-column / 2-column grid: Gold pills `#FFC700` with dark progress indicator bar underneath.
  - Row list (Double Chance, Totals): Left label, dotted leader line (`border-b border-dotted border-white/20 flex-1`), gold odds pill on the right, colored probability bar beneath pill.

---

### 2. Real Player Names for Anytime Scorer

#### `src/lib/betting/derived-markets.ts`
- Remove call to `starPlayersFor` fallback generator.
- Update `buildScorersFromLineups(fixture)`:
  - If `fixture.lineups` is empty or lacks starters/substitutes player arrays, return `[]`.
  - When returning `[]`, `deriveMarkets(fixture)` will omit the `anytime_scorer` market from the market list.

#### `src/app/api/fixtures/[id]/route.ts`
- Omit `anytime_scorer` from markets when no lineups present.

#### `src/server/scheduler/week.ts`
- In `refreshFixtures()`, fixtures starting within 60 minutes trigger a lineup sync check to pull official lineups from API-Football as soon as they become available.

---

### 3. Match Statistics Tab

#### Database Schema (`prisma/schema.prisma`)
Add optional API-Football team IDs to `Fixture`:
```prisma
model Fixture {
  // ... existing fields ...
  homeTeamId Int?
  awayTeamId Int?
}
```

#### API Route: `GET /api/fixtures/[id]/stats`
1. Read fixture from DB.
2. If `homeTeamId` & `awayTeamId` exist, check 15-minute in-memory stats cache (`statsCache.get(fixtureId)`).
3. If cache miss, fetch from API-Football adapter:
   - `GET /fixtures?team={homeTeamId}&last=5`
   - `GET /fixtures?team={awayTeamId}&last=5`
   - `GET /fixtures?h2h={homeTeamId}-{awayTeamId}`
4. Cache result for 15 minutes.
5. If API-Football fails or quota exhausted, execute fallback DB query: select last 5 fixtures for `homeTeam` and `awayTeam` from local `Fixture` table.
6. Return JSON response:
   ```ts
   {
     homeForm: Array<{ result: 'W'|'D'|'L', opponent: string, score: string, date: string }>,
     awayForm: Array<{ result: 'W'|'D'|'L', opponent: string, score: string, date: string }>,
     h2h: Array<{ homeTeam: string, awayTeam: string, score: string, date: string, winner: string }>,
     statsSummary: { homeWinPct: number, drawPct: number, awayWinPct: number }
   }
   ```

#### Component: `src/components/fixture/FixtureStats.tsx`
- Rendered inside fixture page when "Statistiques" tab is active.
- **Form Section**: Visual W/D/L pill badges for last 5 matches of both home and away teams.
- **H2H Section**: Card list showing recent head-to-head match outcomes between the two teams.
- **Pitch / Lineup Section**: Pitch graphic showing team formation (e.g. 4-3-3) if lineups exist.

---

### 4. Community Tab & Copy Bet

#### Global Navigation (`src/components/layout/MobileNav.tsx`, `Header.tsx`, `Sidebar.tsx`)
- Add **Communauté** tab pointing to `/community`.

#### API Route: `GET /api/community?tab=feed|top&period=today|week`
- `tab=feed`: Fetch latest 20 settled or open bets (`Bet` records). Include `user: { username, avatar, isBot }`, `legs: { fixture, marketKey, selectionKey, odds }`, `stakeTotal`, `payout`, `status`.
- `tab=top`: Calculate top bettors ordered by win rate (`settledWins / totalSettled`), filtering by `placedAt` date range (today / this week), minimum 3 settled bets required.

#### Components:
- `src/app/community/page.tsx`: Full-page Community view with sub-tabs "Public Feed" & "Top Bettors".
- `src/components/fixture/FixtureCommunity.tsx`: Embedded tab in match detail page showing public bets placed on this specific match.
- **Copy Bet Action**: Button on each bet card ("Copier le pari"). When clicked, iterates over bet legs, calls `useBetSlip.getState().addLeg(...)` or `addCombination(...)`, and opens the bet slip panel with feedback toast "Pari copié dans le coupon !".

---

## Verification & Testing Strategy

1. **Unit Tests**:
   - `derived-markets.test.ts`: Verify Anytime Scorer is missing when lineups are empty; verify no fake player names.
   - `stats-cache.test.ts`: Verify 15-minute in-memory cache hit/miss logic and DB fallback.
   - `community-winrate.test.ts`: Verify win-rate ranking calculation and bot inclusion.
2. **Standard Quality Gate**:
   - `npx vitest run` (all tests pass)
   - `npx tsc --noEmit` (0 type errors)
   - `npm run lint` (0 lint errors)
   - `node scripts/smoke.mjs` (Smoke test passes)
3. **E2E Visual Verification**:
   - Restart supervised process and test home feed match cards with Betclic gold style.
   - Test fixture page sub-tabs: Marchés, Statistiques, Composition, Communauté.
   - Test 1-click Copy Bet populates bet slip correctly.

## Out of Scope
- Custom database persistence for API-Football H2H calls (in-memory cache is sufficient).
- Real-time WebSocket streaming for community bet feed (REST fetching is sufficient).
