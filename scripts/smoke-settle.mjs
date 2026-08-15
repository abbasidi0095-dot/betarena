/**
 * Settlement end-to-end: place a patent on scheduled demo fixtures, force one
 * fixture FINISHED with a known score, run the sweep, verify payouts.
 * Usage: BASE=http://localhost:3100 node scripts/smoke-settle.mjs
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://localhost:3100";
const prisma = new PrismaClient();
let cookie = "";
let failures = 0;

function check(name, cond, extra = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  const scheduled = await prisma.fixture.findMany({
    where: { status: "SCHEDULED" },
    include: { markets: { include: { odds: true } } },
    orderBy: { kickoff: "asc" },
    take: 3,
  });
  if (scheduled.length < 3) throw new Error("need 3 scheduled demo fixtures");

  const suffix = Date.now();
  await req("POST", "/api/auth/register", {
    username: `settle_${suffix}`,
    email: `settle_${suffix}@test.local`,
    password: "password123",
  });

  // Patent: legs A=home(win), B=away(lose), C=draw(void-ish → we make it win to test PARTIAL)
  const oddsOf = (f, mk, sk) =>
    f.markets.find((m) => m.key === mk)?.odds.find((o) => o.selectionKey === sk);
  const [fA, fB, fC] = scheduled;
  const oA = oddsOf(fA, "h2h", "home");
  const oB = oddsOf(fB, "h2h", "away");
  const oC = oddsOf(fC, "h2h", "draw");

  const place = await req("POST", "/api/bets", {
    selections: [
      { fixtureId: fA.id, marketKey: "h2h", selectionKey: "home" },
      { fixtureId: fB.id, marketKey: "h2h", selectionKey: "away" },
      { fixtureId: fC.id, marketKey: "h2h", selectionKey: "draw" },
    ],
    stake: 63,
    type: "SYSTEM",
    systemType: "PATENT",
  });
  check("patent placed", place.status === 200, JSON.stringify(place.json));
  const balanceAfterPlace = place.json.pointBalance; // 1100 - 63 = 1037

  // Force results: A home wins (2-0), B home wins (1-0 → away selection LOST), C draw (1-1)
  await prisma.fixture.update({
    where: { id: fA.id },
    data: { status: "FINISHED", homeScore: 2, awayScore: 0, minute: 90 },
  });
  await prisma.fixture.update({
    where: { id: fB.id },
    data: { status: "FINISHED", homeScore: 1, awayScore: 0, minute: 90 },
  });
  await prisma.fixture.update({
    where: { id: fC.id },
    data: { status: "FINISHED", homeScore: 1, awayScore: 1, minute: 90 },
  });

  const settle = await req("POST", "/api/dev/tools");
  check("sweep ok", settle.status === 200);
  const mine = settle.json.notifications.filter((n) => n.pointBalance !== undefined);
  check("got settlement notification", mine.length >= 1, JSON.stringify(settle.json));

  const bets = await req("GET", "/api/bets?status=settled");
  const bet = bets.json?.bets?.find((b) => b.type === "SYSTEM");
  check("patent settled", !!bet);

  if (bet) {
    // Expected: legs A WON, B LOST, C WON. Patent = 3 singles + 3 doubles + 1 treble.
    // Winning combos: single A, single C, double A+C (treble contains B → lost; doubles with B lost; single B lost)
    const stake = Math.floor(63 / 7); // 9 per combo
    const expected =
      Math.floor(stake * oA.value) + Math.floor(stake * oC.value) + Math.floor(stake * oA.value * oC.value);
    check(`status PARTIAL (got ${bet.status})`, bet.status === "PARTIAL");
    check(`payout ${bet.payout} == expected ${expected}`, bet.payout === expected);
    check(
      `2 winning combos (got ${bet.combinations.filter((c) => c.status === "WON").length})`,
      bet.combinations.filter((c) => c.status === "WON").length === 3,
    );
    check("balance credited", mine.some((n) => n.payout === expected));
  }

  // Single + acca checks
  const sp = await req("POST", "/api/bets", {
    selections: [{ fixtureId: fA.id, marketKey: "totals", selectionKey: "over_2.5" }],
    stake: 20,
    type: "SINGLE",
  });
  check("bet on finished fixture rejected", sp.status === 422, `got ${sp.status}`);

  console.log("");
  if (failures > 0) {
    console.error(`SETTLE SMOKE FAILED: ${failures}`);
    process.exit(1);
  }
  console.log("SETTLE SMOKE PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
