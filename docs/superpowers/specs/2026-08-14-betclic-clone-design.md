# BetArena — Betclic-style Free-to-Play Betting Platform (Design Spec)

Date: 2026-08-14
Status: Approved (design phase)

## 1. Overview

A free-to-play, point-based sports betting web app cloning Betclic's UI/UX language
(dark theme, vibrant red, sliding bet slip, live odds flashing) with **no real money** —
only virtual "BetPoints". Real fixture/odds data comes from free-tier sports APIs using
a pool of user-supplied API keys with automatic fallback, so quotas never run dry.

Working name: **BetArena**. Project root: `/home/ubuntu/betclic-clone`.

## 2. Goals & Non-Goals

### Goals
- Betclic-faithful UI: `#121212` backgrounds, `#E50813` red, white text, yellow/green
  win accents, Inter typography, mobile-first responsive layout.
- Real football fixtures, pre-match and live odds, live scores, results.
- Single, Accumulator, and System bets (Trixie, Patent, Yankee, Lucky 15) with
  server-authoritative placement and automatic settlement on real results.
- Multi-user social: registration/login, friends, global + friends leaderboards
  (points won, win %, ROI), bet history.
- Real-time updates via Socket.io WebSockets (odds changes, live scores, bet settlement).
- Points economy: 1,000 start, daily bonus, zero-balance rescue top-up.

### Non-Goals (v1)
- Tennis/basketball (football only; adapter layer makes adding them later cheap).
- Real-money anything, payments, KYC.
- Live pitch-by-pitch ball tracking (tracker shows event feed + zone visualizer only).
- Cash-out, bet editing, in-play bet builder markets beyond 1X2/O2.5/BTTS.

## 3. Sports & Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Data source | Real APIs, pool of free-tier keys with fallback |
| Storage | Fly Postgres + Prisma, full multi-user auth |
| Hosting | Fly.io, single long-lived Node process |
| Providers | API-Football (fixtures/scores/results) + The Odds API (odds) |
| Sports | Football only v1 |
| Bet types | Single + Accumulator + System |
| Real-time | Socket.io attached to custom Next.js server |

## 4. Architecture

Single unified Node process on Fly.io (approved Approach A):

```
server.ts (custom server)
├─ Next.js App Router — React pages + API route handlers
├─ Socket.io — namespaces/rooms: live:fixture:{id}, user:{userId}
└─ Scheduler (in-process intervals, all with timeouts + error isolation)
   ├─ fixtures refresh — every 6h (+ results sweep)
   ├─ live scores — every 60s, only while matches are in-play
   ├─ odds — every 30m pre-match, every 90s for in-play fixtures
   └─ settlement sweep — every 60s
```

Request flow:
1. Scheduler polls provider adapters → normalizes → upserts to Postgres (Prisma).
2. Odds upsert stores `previousValue`; changed odds emit `odds:update` to
   `live:fixture:{id}` rooms and to a global `live` room for feed cards.
3. Score changes emit `score:update` with event feed payload (goal/card/sub events).
4. Settlement worker resolves legs on `FINISHED` fixtures, credits points, emits
   `bet:settled` to `user:{userId}`.

### API Key Pool (quota resilience)
- Env CSVs: `API_FOOTBALL_KEYS`, `ODDS_API_KEYS`.
- `KeyPool` tracks per-key remaining quota (from response headers), rotates on
  401/429/quota-exhausted, round-robins healthy keys, cools down exhausted keys
  until their reset window.
- Failures degrade gracefully: serve cached DB data, mark `dataStale: true` in API
  responses; UI shows a subtle freshness indicator. Never crash, never block bets
  on stale odds (bets use last stored odds).

### Odds markets
- The Odds API: `h2h` (1X2) and `totals` (Over/Under 2.5) are standard;
  `btts` (Both Teams to Score) is an *additional* market — when unavailable for a
  competition, the BTTS market is hidden for those fixtures, never fabricated.

## 5. Data Model (Prisma / Postgres)

- **User** — id, username (unique), email (unique), passwordHash, pointBalance,
  lastDailyBonusAt, lastRescueAt, stats (totalWon, totalStaked, betsWon, betsLost),
  isBot, createdAt.
- **Friendship** — requesterId, addresseeId, status (PENDING/ACCEPTED/DECLINED).
- **League** — providerId, name, country, logo, season.
- **Fixture** — providerId (unique), leagueId, kickoff, status
  (SCHEDULED/LIVE/FINISHED), homeTeam, awayTeam, homeScore, awayScore, minute,
  events (Json: [{type, minute, team, player, zone}]).
- **Market** — fixtureId, key (h2h/totals/btts), status (OPEN/SUSPENDED/CLOSED).
- **Odds** — marketId, selectionKey (e.g. `home`/`draw`/`away`, `over_2.5`, `btts_yes`),
  value, previousValue, updatedAt.
- **Bet** — userId, type (SINGLE/ACCA/SYSTEM), systemType (Trixie/Patent/Yankee/Lucky15,
  nullable), stakeTotal, potentialReturn, status (OPEN/WON/LOST/VOID/PARTIAL),
  placedAt, settledAt.
- **BetLeg** — betId, fixtureId, marketKey, selectionKey, oddsLocked, selectionName,
  status (OPEN/WON/LOST/VOID), settledAt.
- **BetCombination** (system bets) — betId, legSelection (Json array of leg ids),
  stake, oddsProduct, status, payout.

All money-like values stored as integer BetPoints (no decimals). Odds as Decimal.

## 6. Betting Engine (server-authoritative)

### Placement (API route `POST /api/bets`)
1. Auth via JWT httpOnly cookie.
2. Validate: selections exist, markets OPEN, fixture not started (pre-match) —
   in-play placement allowed while LIVE with current stored odds.
3. Compute per type:
   - SINGLE: N independent bets; return = stake × odds each.
   - ACCA: one bet, product of all odds; any leg LOST → bet LOST.
   - SYSTEM: generate combinations from system type
     (Trixie = 3 doubles + 1 treble = 4 combos; Patent = Trixie + 3 singles = 7;
     Yankee = 6 doubles + 4 trebles + 1 fourfold = 11 combos;
     Lucky 15 = Yankee + 4 singles = 15). Per-combination stake =
     totalStake / comboCount (integer division, remainder returned to balance).
     Payout = Σ winning combos.
4. Deduct stake inside a Prisma transaction; insufficient balance → 422.

### Settlement (sweep, every 60s)
1. Find fixtures status=FINISHED with unresolved legs.
2. Resolve each leg against final score (1X2 winner, total goals vs line, BTTS).
   Market unavailable at kickoff or fixture voided → leg VOID
   (VOID reduces ACCA odds product to ×1.00; system combos re-price; SINGLE refunds).
3. Bet status: WON / LOST / PARTIAL (system with mixed outcomes) / VOID.
4. Credit payout atomically; update User stats aggregates; emit `bet:settled`.
5. Idempotency: leg-level `settledAt` guard; sweep is restart-safe.

### Points Economy
- Start: 1,000 BetPoints on registration.
- Daily bonus: +100, claimable once per 24h (`lastDailyBonusAt`).
- Rescue top-up: +500 when balance = 0, once per 24h (`lastRescueAt`).

## 7. Real-Time Contract (Socket.io events)

Client → Server: `subscribe:fixture`, `unsubscribe:fixture`, `subscribe:live`.
Server → Client:
- `odds:update` { fixtureId, marketKey, selectionKey, value, previousValue }
- `score:update` { fixtureId, homeScore, awayScore, minute, events }
- `bet:settled` { betId, status, payout, pointBalance }
- `balance:update` { pointBalance }

Reconnect with exponential backoff; on reconnect client re-syncs via REST
(`/api/fixtures/live`, `/api/me`) then re-subscribes.

## 8. UI / UX (Betclic language, mobile-first)

- **Shell:** sticky header (logo, search with fixture/team autocomplete, balance chip
  with animated count, profile menu), left sidebar with league quick-nav (collapses to
  hamburger drawer on mobile), main feed, floating bet-slip pill with selection count.
- **Match cards:** teams + crests (initials fallback), kickoff time or pulsing LIVE pill
  with minute + score, three primary odds buttons (1X2, O/U 2.5, BTTS). Odds buttons
  flash green (up) / red (down) via Framer Motion layout + key change animation.
- **Bet slip:** right sliding drawer ≥lg, drag-handle bottom sheet on mobile.
  Tab switcher Single/Acca/System; stake input with quick chips (+10/+50/+100/MAX);
  live total-odds and potential return computation; remove selections with animation.
- **Live tracker page** (fixture detail): big scoreboard + minute, event feed timeline
  (goals, cards, subs), simple SVG pitch visualizer placing event dots in zones.
- **Win celebration:** canvas-confetti burst + toast "You won X points" on
  `bet:settled` with WON/PARTIAL status.
- **Sound:** WebAudio-generated blips on selection and win; toggle in header,
  default muted, persisted in localStorage.
- **Pages:** `/` (top bets + live + upcoming), `/live`, `/sport/football`,
  `/league/[id]`, `/fixture/[id]` (tracker), `/my-bets` (open/settled tabs),
  `/leaderboard` (global/friends tabs), `/friends`, `/auth` (login/register),
  `/profile`.
- **Stack:** Next.js App Router, Tailwind CSS, Framer Motion, Zustand (bet slip +
  socket store, persisted slip selections), Lucide icons, canvas-confetti.

## 9. Error Handling

- Adapter layer: per-request timeout (10s), retries once on network error, key
  rotation on quota/auth failure; provider outages → cached data + stale flag.
- API routes: zod-validated inputs, typed error envelope `{ error: { code, message } }`.
- Client: toast for user errors, inline balance validation in slip, socket reconnect
  banner when disconnected >5s.

## 10. Testing

- **Vitest unit tests (money-handling core — required to pass):**
  - System-bet combination generation (all 4 types), stake division + remainder.
  - Payout math for SINGLE/ACCA/SYSTEM incl. VOID legs and PARTIAL outcomes.
  - Settlement resolution: 1X2 / totals / BTTS from final scores; VOID rules.
  - KeyPool rotation, cooldown, and quota-header parsing.
- UI: `next build` + `tsc --noEmit` + ESLint as gates.
- Manual smoke script (dev): place bet → force-settle via dev endpoint → verify
  balance, history, leaderboard aggregates.

## 11. Deployment

- Fly.io app (single process), Fly Postgres attachment, `fly deploy`.
- Env: `DATABASE_URL`, `JWT_SECRET`, `API_FOOTBALL_KEYS`, `ODDS_API_KEYS`,
  `NODE_ENV=production`.
- Migrations run via release command (`npx prisma migrate deploy`).
- `fly.toml`: HTTP service on internal port 3000, WebSocket traffic passes through
  (Fly supports long-lived connections); machine count pinned to 1 so the
  scheduler/settlement worker stays single-instance.

## 12. Directory Layout

```
betclic-clone/
├─ src/
│  ├─ app/            # Next.js App Router pages + API routes
│  ├─ components/     # UI components (feed, slip, tracker, ...)
│  ├─ server/
│  │  ├─ adapters/    # api-football.ts, odds-api.ts, key-pool.ts
│  │  ├─ scheduler/   # fixtures.ts, odds.ts, scores.ts, settlement.ts
│  │  └─ socket/      # socket.io setup + event handlers
│  ├─ lib/
│  │  ├─ betting/     # combos.ts, payout.ts, settlement.ts (pure, tested)
│  │  └─ auth.ts, points.ts, validation.ts
│  └─ stores/         # Zustand: slip, socket, user
├─ prisma/schema.prisma + migrations
├─ server.ts          # custom server entry
├─ scripts/seed-bots.ts
└─ tests/ (vitest)
```
