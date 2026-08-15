/**
 * Derived-market e2e: place dc + handicap + exact bets, force results,
 * verify settlement.
 * Usage: BASE=http://localhost:3100 node scripts/smoke-derived.mjs
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://localhost:3100";
const prisma = new PrismaClient();
let cookie = "";
let failures = 0;
const check = (n, c, e = "") => {
  if (c) console.log(`  ✓ ${n}`);
  else {
    failures++;
    console.error(`  ✗ ${n} ${e}`);
  }
};
async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return { status: res.status, json: await res.json().catch(() => null) };
}

const main = async () => {
  const fx = await prisma.fixture.findMany({
    where: { status: "SCHEDULED" },
    include: { markets: { include: { odds: true } } },
    orderBy: { kickoff: "asc" },
    take: 3,
  });
  const [fA, fB, fC] = fx;

  const suffix = Date.now();
  await req("POST", "/api/auth/register", {
    username: `derived_${suffix}`,
    email: `derived_${suffix}@t.local`,
    password: "password123",
  });

  console.log("— detail API has derived markets —");
  const detail = await req("GET", `/api/fixtures/${fA.id}`);
  const dm = detail.json?.derivedMarkets;
  check("derivedMarkets present", !!dm);
  check("dc has 3", dm?.dc?.length === 3);
  check("handicap has 4", dm?.handicap?.length === 4);
  check("exact has 5", dm?.exact?.length === 5);
  check("scorers have 10", dm?.scorers?.length === 10);

  console.log("— place derived-market bets —");
  const dc = await req("POST", "/api/bets", {
    selections: [
      { fixtureId: fA.id, marketKey: "dc", selectionKey: dm.dc[0].selectionKey },
      { fixtureId: fB.id, marketKey: "handicap", selectionKey: "away_+1" },
      { fixtureId: fC.id, marketKey: "exact", selectionKey: "g3" },
    ],
    stake: 50,
    type: "ACCA",
  });
  check("acca with derived markets placed", dc.status === 200, JSON.stringify(dc.json));

  const scorer = await req("POST", "/api/bets", {
    selections: [
      { fixtureId: fA.id, marketKey: "scorer", selectionKey: dm.scorers[0].selectionKey },
    ],
    stake: 20,
    type: "SINGLE",
  });
  check("scorer bet placed", scorer.status === 200);

  // Force results: A home 2-0 (dc home_or_draw WON), B 0-0 (away+1 WON, push? no WON), C 2-1 (g3 WON)
  await prisma.fixture.update({ where: { id: fA.id }, data: { status: "FINISHED", homeScore: 2, awayScore: 0, minute: 90 } });
  await prisma.fixture.update({ where: { id: fB.id }, data: { status: "FINISHED", homeScore: 0, awayScore: 0, minute: 90 } });
  await prisma.fixture.update({ where: { id: fC.id }, data: { status: "FINISHED", homeScore: 2, awayScore: 1, minute: 90 } });

  console.log("— settle —");
  const settle = await req("POST", "/api/dev/tools");
  check("sweep ok", settle.status === 200);

  const bets = await req("GET", "/api/bets?status=settled");
  const acca = bets.json?.bets?.find((b) => b.type === "ACCA");
  check("acca settled", !!acca);
  if (acca) {
    check("acca WON (all 3 legs won)", acca.status === "WON", `got ${acca.status}`);
    check("acca legs WON", acca.legs.every((l) => l.status === "WON"), JSON.stringify(acca.legs.map((l) => l.status)));
    check("payout = stake × product", acca.payout > 0, `payout ${acca.payout}`);
  }

  console.log("");
  if (failures > 0) {
    console.error(`DERIVED SMOKE FAILED: ${failures}`);
    process.exit(1);
  }
  console.log("DERIVED SMOKE PASSED");
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
