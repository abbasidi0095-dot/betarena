import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { setupSocket } from "@/server/socket";
import { startInterval } from "@/server/scheduler";
import { refreshFixtures } from "@/server/scheduler/fixtures";
import { refreshLiveScores } from "@/server/scheduler/scores";
import { refreshPreMatchOdds, refreshInPlayOdds } from "@/server/scheduler/odds";
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
  const anyApiConfigured = apiFootball.isConfigured() || oddsApi.isConfigured();
  if (anyApiConfigured) {
    const fixtureCount = await prisma.fixture.count();
    if (fixtureCount === 0) {
      console.log("[boot] no fixtures in db — running initial refresh");
      await refreshFixtures(io).catch(() => undefined);
      await refreshPreMatchOdds(io).catch(() => undefined);
    }
  }

  if (apiFootball.isConfigured()) {
    startInterval("fixtures", 6 * 3600 * 1000, () => refreshFixtures(io));
    startInterval("scores", 60 * 1000, () => refreshLiveScores(io));
  }
  if (oddsApi.isConfigured()) {
    startInterval("odds:prematch", 30 * 60 * 1000, () => refreshPreMatchOdds(io));
    startInterval("odds:inplay", 90 * 1000, () => refreshInPlayOdds(io));
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
