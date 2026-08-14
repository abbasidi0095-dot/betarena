#!/bin/bash
# Minimal respawn supervisor for local runs (survives OOM kills).
cd "$(dirname "$0")/.."
export NODE_ENV=production
export PORT="${PORT:-3100}"
while true; do
  node dist/server.cjs >> /tmp/opencode/betarena.log 2>&1
  echo "[supervisor] server exited ($?) — restarting in 3s" >> /tmp/opencode/betarena.log
  sleep 3
done
