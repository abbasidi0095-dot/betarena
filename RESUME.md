# BetArena — Session Resume Notes

Last updated: 2026-08-14 (session by opencode AI assistant)

## How to resume

- Codebase: `/home/ubuntu/betclic-clone` (branch `master`, remote `origin` → https://github.com/abbasidi0095-dot/betarena)
- Running app: http://localhost:3100 (supervised by `scripts/supervise.sh`; log `/tmp/opencode/betarena.log`)
- Tunnel: ephemeral `cloudflared` quick tunnel, log `/tmp/opencode/tunnel.log` — URL from `grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/opencode/tunnel.log`
- Dev DB: Postgres `postgresql://postgres:postgres@localhost:5433/betarena` (Postgres 18 on port 5433, local)
- Port 3000 is owned by the user's PM2 app `jobseek-web` — **do not kill PM2**; BetArena runs on 3100.

## State

- All 14 plan tasks complete, merged to `master`, pushed to GitHub.
- Gates green at push time: 60 vitest tests, tsc (app + server), eslint 0 errors, `next build` OK.
- E2E smokes green: `scripts/smoke.mjs`, `scripts/smoke-settle.mjs`, `scripts/smoke-socket.mjs`.
- Realtime verified: socket connect → `subscribe:live` → odds jitter → `odds:update` received.
- Box quirk: OOM killer reaps bare node processes (7.6 GB RAM, tight) → use the supervisor loop, not naked `node dist/server.cjs`.

## Known pending / next steps

1. **Investigate webapp error** (reported by user after tunnel testing) — reproduce via tunnel URL, check `/tmp/opencode/betarena.log` and browser console.
2. Dev-mode loop (`npm run dev`) sanity check — esbuild watch + `node --watch`; prod path is the verified one.
3. Optional: `fly deploy` (Dockerfile + fly.toml ready; needs `fly launch`, Postgres attach, secrets).

## Useful commands

```bash
npm test                              # vitest unit tests
npm run build && npm start            # prod build + serve (or scripts/supervise.sh)
node scripts/smoke.mjs                # e2e (BASE env overrides URL)
node scripts/smoke-settle.mjs         # settlement money-path e2e
node scripts/smoke-socket.mjs         # realtime e2e
npm run seed:bots                     # 30 bots + demo fixtures/odds (keyless demo)
```
