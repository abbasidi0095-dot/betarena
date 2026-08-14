# BetArena — Free-to-Play Betclic-style Betting Platform

A Betclic-inspired sports betting web app that uses **virtual BetPoints only** —
no real money, ever. Real football fixtures, odds, live scores and results from
free-tier sports APIs with automatic multi-key quota fallback.

## Stack

- **Frontend:** Next.js 15 (App Router), Tailwind CSS v4, Framer Motion, Zustand, Lucide, canvas-confetti
- **Backend:** Custom Node server (`server.ts` → esbuild → `dist/server.cjs`) hosting Next + Socket.io + in-process schedulers
- **Database:** PostgreSQL via Prisma
- **Sports data:** [API-Football](https://www.api-football.com) (fixtures/scores/results) + [The Odds API](https://the-odds-api.com) (odds) behind a rotating key pool
- **Tests:** Vitest (betting math, settlement, key pool)

## Quick start (local)

```bash
# 1. Postgres (any instance; local port 5433 used in .env example)
createdb betarena

# 2. Install + configure
npm install
cp .env .env.local   # or edit .env directly

# 3. Schema + demo data
npx prisma migrate dev
npm run seed:bots     # 30 leaderboard bots + demo fixtures/odds (no API keys needed)

# 4. Build + run
npm run build
npm start             # http://localhost:3000
```

Dev loop: `npm run dev` (esbuild watch + `node --watch`, Next dev compilation).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | yes | Auth token secret (≥ 8 chars) |
| `API_FOOTBALL_KEYS` | no | CSV of API-Football keys (quota-rotated) |
| `ODDS_API_KEYS` | no | CSV of The Odds API keys (quota-rotated) |
| `ALLOW_DEV_TOOLS` | no | `1` enables `/api/dev/tools` (settle sweep + odds jitter) |

With no API keys the app runs on seeded demo data. With keys configured, the
scheduler polls real data: fixtures every 6h, live scores every 60s, odds every
30m pre-match / 90s in-play, settlement every 60s. Keys rotate automatically on
401/429/quota errors; exhausted keys cool down until their reset window.

## Point economy

- 1,000 BetPoints on registration
- Daily bonus: +100 (24h cooldown)
- Rescue top-up: +500 when balance hits 0 (24h cooldown)

## Bet types

- **Single** — stake per selection, N bets
- **Acca** — combined odds, all legs must win (VOID legs re-price at ×1.00)
- **System** — Trixie (4 combos), Patent (7), Yankee (11), Lucky 15 (15);
  per-combo stake = ⌊stake/combos⌋, remainder refunded instantly

Settlement is automatic, idempotent (leg-level `settledAt` guard) and pays
`⌊stake × Π odds⌋` per winning combination.

## Realtime (Socket.io)

Server → client: `odds:update` (drives green/red flash), `score:update`,
`bet:settled` (drives confetti + toast), `balance:update`.
Client → server: `subscribe:fixture`, `unsubscribe:fixture`, `subscribe:live`.

## Deploy (Fly.io)

```bash
fly launch --no-deploy        # attach fly.toml
fly postgres create --name betarena-db
fly postgres attach betarena-db
fly secrets set JWT_SECRET=... API_FOOTBALL_KEYS=... ODDS_API_KEYS=...
fly deploy                     # release command runs prisma migrate deploy
```

Single machine (count = 1) keeps the scheduler/settlement worker single-instance.
WebSockets pass through Fly's proxy natively.

## Testing

```bash
npm test               # vitest — combos, payouts, settlement, key pool
node scripts/smoke.mjs           # e2e vs running server (BASE=... to override)
node scripts/smoke-settle.mjs    # settlement money-path e2e
node scripts/smoke-socket.mjs    # realtime e2e
```

## Responsible play

BetArena is a game. Points have no monetary value, cannot be purchased,
transferred, or withdrawn. It is intended for entertainment and education only.
