# Abbet — Session Resume Notes

Last updated: 2026-08-15 (session by opencode AI assistant)

## How to resume

- Codebase: `/home/ubuntu/betclic-clone` (branch `master`, remote `origin` → https://github.com/abbasidi0095-dot/betarena)
- Running app: http://localhost:3100 (supervised by `scripts/supervise.sh`; log `/tmp/opencode/betarena.log`)
- Tunnel: ephemeral `cloudflared` quick tunnel, log `/tmp/opencode/tunnel.log` — URL from `grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/opencode/tunnel.log`
- Dev DB: Postgres `postgresql://postgres:postgres@localhost:5433/betarena` (Postgres 18 on port 5433, local)
- Port 3000 is owned by the user's PM2 app `jobseek-web` — **do not kill PM2**; Abbet runs on 3100.

## State

- All 14 plan tasks complete, merged to `master`, pushed to GitHub.
- Gates green at push time: 60 vitest tests, tsc (app + server), eslint 0 errors, `next build` OK.
- E2E smokes green: `scripts/smoke.mjs`, `scripts/smoke-settle.mjs`, `scripts/smoke-socket.mjs`.
- Realtime verified: socket connect → `subscribe:live` → odds jitter → `odds:update` received.
- Box quirk: OOM killer reaps bare node processes (7.6 GB RAM, tight) → use the supervisor loop, not naked `node dist/server.cjs`.

## Known pending / next steps

1. ~~Investigate webapp error~~ **FIXED 2026-08-14**: Prisma Decimal serialized odds as JSON strings → `oddsToString()` crashed on `toFixed()` (white screen). Normalized in `src/lib/serialize.ts` (used by /api/fixtures, /api/fixtures/[id], /api/search) + defensive `Number()` coercion in `format.ts`. Verified error-free in headless Chromium across all 7 pages (logged in).
2. Dev-mode loop (`npm run dev`) sanity check — esbuild watch + `node --watch`; prod path is the verified one.
3. Optional: `fly deploy` (Dockerfile + fly.toml ready; needs `fly launch`, Postgres attach, secrets).
4. **DONE 2026-08-15**: Fixed fallback odds — every scheduled match without real
   odds gets deterministic 1X2 + totals + BTTS (`src/lib/betting/fallback-odds.ts`,
   backfilled at boot + 6h interval via `backfillFallbackOdds`). Real Odds-API
   rows untouched. Feed now sorts big leagues first via `League.priority`
   (2 = top-6+UCL, 1 = Europa/Eredivisie/Primeira/Süper Lig/Belgian, 0 = rest;
   synced at boot via `syncLeaguePriorities`).
5. **DONE 2026-08-15**: Cross-provider dedup — `cleanupDuplicateFixtures()`
   (`src/server/scheduler/dedup.ts`) removes football-data fixtures that
   duplicate an API-Football fixture (kickoff ±20min + token-subset team
   names, e.g. "Alaves" vs "Deportivo Alavés"). Bet legs are migrated to the
   surviving twin before deletion. Runs at boot + 12h interval.
6. **DONE 2026-08-15**: Betclic visual restyle — gold `#FFC700` odds pills
   with implied-probability bars, dark `#181a20` cards (`--color-card-dark`,
   `--color-betclic-gold` tokens), restyled MatchCard (league strip, centered
   team row + score pill, 1X2 gold buttons), ScoreBoard (crests, gold accents,
   "vs" pill), and fixture-page market panels (2-col layout for DC/handicap/
   exact). Commits: `d8a4d77`, `8bccb23`.
7. **DONE 2026-08-15**: Real scorer names only — anytime-scorer market is
   derived exclusively from real lineups; without lineups it is hidden
   (`deriveMarkets` returns `[]`, page filters empty markets). Settlement
   already keyed off real goal events, so no fake name could ever win.
   Scheduler lineup refresh tightened to 15-min. Commits: `c20ec9e`, `9373a2b`.
8. **DONE 2026-08-15**: Statistiques tab — `GET /api/fixtures/[id]/stats`
   (API-Football team last-5 + H2H, 15-min in-memory TTL cache, DB fallback
   on quota/error; `Fixture.homeTeamId`/`awayTeamId` stored on upsert +
   backfilled at boot). `FixtureStats` renders form guide (W/D/L), H2H list,
   result split bar. Commits: `5864297`, `ab15eda`.
9. **DONE 2026-08-15**: Communauté tab — `GET /api/community` (public feed
   incl. bots + top bettors by win rate, min 3 settled bets, today/week
   periods via `src/lib/community/rank.ts`). UI: `/community` page,
   fixture-page tab, 1-click "Copier le pari" (client-side legs → slip via
   `useSlip.add()`), nav links in MobileNav/Header/Sidebar. Commits:
   `a6cdc0d`, `16a4e09`.

## Useful commands

```bash
npm test                              # vitest unit tests
npm run build && npm start            # prod build + serve (or scripts/supervise.sh)
node scripts/smoke.mjs                # e2e (BASE env overrides URL)
node scripts/smoke-settle.mjs         # settlement money-path e2e
node scripts/smoke-socket.mjs         # realtime e2e
npm run seed:bots                     # 30 bots + demo fixtures/odds (keyless demo)
```
