import "dotenv/config";
// IMPORTANT: this must be the FIRST import — ESM imports are hoisted, so the
// polyfill only wins if it lives in a module imported before `next`.
import "./scripts/als-polyfill.cjs";

import { createServer } from "http";
import next from "next";
import { setupSocket } from "@/server/socket";
import { startInterval } from "@/server/scheduler";
import { refreshFixtures } from "@/server/scheduler/fixtures";
import { refreshLiveScores } from "@/server/scheduler/scores";
import { refreshOddsFixturesAndScores } from "@/server/scheduler/odds";
import { runSettlement } from "@/server/scheduler/settlement";
import { prisma } from "@/lib/db";
import * as apiFootball from "@/server/adapters/api-football";
import * as oddsApi from "@/server/adapters/odds-api";

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
    const fixtureCount = await prisma.fixture.count();
    if (fixtureCount === 0) {
      console.log("[boot] no fixtures in db — running initial refresh");
      await refreshFixtures(io).catch(() => undefined);
    }
  }
  if (oddsApi.isConfigured()) {
    console.log("[boot] The Odds API keys found — fetching real fixtures + odds");
    await refreshOddsFixturesAndScores(io).catch(() => undefined);
  }

  if (apiFootball.isConfigured()) {
    startInterval("fixtures", 6 * 3600 * 1000, () => refreshFixtures(io));
    startInterval("scores", 60 * 1000, () => refreshLiveScores(io));
  }
  if (oddsApi.isConfigured()) {
    // Quota-budgeted: ~12 odds calls + ~6 scores calls per cycle, 2 keys.
    startInterval("odds:real", 6 * 3600 * 1000, () => refreshOddsFixturesAndScores(io));
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
