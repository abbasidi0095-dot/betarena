import "dotenv/config";
// IMPORTANT: this must be the FIRST import — ESM imports are hoisted, so the
// polyfill only wins if it lives in a module imported before `next`.
import "./scripts/als-polyfill.cjs";

import { createServer } from "http";
import next from "next";
import { setupSocket } from "@/server/socket";
import { startInterval } from "@/server/scheduler";
import { refreshFixtures, refreshStandings, refreshLineups } from "@/server/scheduler/fixtures";
import { refreshLiveMinutes } from "@/server/scheduler/scores";
import { refreshRealOdds } from "@/server/scheduler/odds";
import { refreshWeekFixtures } from "@/server/scheduler/week";
import { runSettlement } from "@/server/scheduler/settlement";
import * as apiFootball from "@/server/adapters/api-football";
import * as oddsApi from "@/server/adapters/odds-api";
import * as footballData from "@/server/adapters/football-data";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("[next] request error", err);
      res.statusCode = 500;
      res.end("internal error");
    });
  });

  const io = setupSocket(httpServer);

  // Boot: initial refresh if configured, then steady-state intervals.
  if (apiFootball.isConfigured()) {
    console.log("[boot] API-Football key found — fetching today's fixtures");
    await refreshFixtures(io).catch(() => undefined);
    void refreshStandings(io).catch(() => undefined);
    void refreshLineups(io).catch(() => undefined);
  }
  if (footballData.isConfigured()) {
    // Full week, ALL competitions, real crests (football-data has no date cap)
    console.log("[boot] football-data keys found — fetching the full week");
    await refreshWeekFixtures(io).catch(() => undefined);
  }
  if (oddsApi.isConfigured()) {
    console.log("[boot] The Odds API keys found — attaching real odds");
    await refreshRealOdds(io).catch(() => undefined);
  }

  if (apiFootball.isConfigured()) {
    startInterval("fixtures", 12 * 3600 * 1000, () => refreshFixtures(io));
    startInterval("standings", 24 * 3600 * 1000, () => refreshStandings(io));
    startInterval("lineups", 3 * 3600 * 1000, () => refreshLineups(io));
  }
  if (footballData.isConfigured()) {
    // 1 poll/min rotating 4 free keys — true minute-by-minute live updates
    void refreshLiveMinutes(io).catch(() => undefined);
    startInterval("scores:minute", 60 * 1000, () => refreshLiveMinutes(io));
    startInterval("week", 12 * 3600 * 1000, () => refreshWeekFixtures(io));
  }
  if (oddsApi.isConfigured()) {
    // 6 odds calls per cycle, 2 keys — ~12/day, comfortably under free quota
    startInterval("odds:real", 12 * 3600 * 1000, () => refreshRealOdds(io));
  }
  // Settlement always runs — it is local, no API needed.
  startInterval("settlement", 60 * 1000, () => runSettlement(io));
  // Run settlement once at boot to catch anything finished while down.
  void runSettlement(io).catch(() => undefined);

  httpServer.listen(port, () => {
    console.log(`> BetArena ready on http://${hostname}:${port} (dev=${dev})`);
  });
}

main().catch((err) => {
  console.error("fatal boot error", err);
  process.exit(1);
});
