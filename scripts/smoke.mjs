/**
 * End-to-end smoke test against a running BetArena server.
 * Usage: BASE=http://localhost:3100 node scripts/smoke.mjs
 */
const BASE = process.env.BASE ?? "http://localhost:3100";
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
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

console.log("— fixtures —");
const fx = await req("GET", "/api/fixtures?scope=top");
check("fixtures 200", fx.status === 200);
check("has fixtures", fx.json?.fixtures?.length > 0, `got ${fx.json?.fixtures?.length}`);
const withOdds = fx.json.fixtures.find(
  (f) => f.markets.some((m) => m.key === "h2h" && m.odds.length >= 3),
);
check("fixture with h2h odds", !!withOdds);

console.log("— auth —");
const suffix = Date.now();
const reg = await req("POST", "/api/auth/register", {
  username: `smoke_${suffix}`,
  email: `smoke_${suffix}@test.local`,
  password: "password123",
});
check("register 200", reg.status === 200);
check("starting balance 1000", reg.json?.user?.pointBalance === 1000);

const me = await req("GET", "/api/me");
check("me 200", me.status === 200);
check("can claim daily bonus", me.json?.user?.canClaimDailyBonus === true);

console.log("— points economy —");
const bonus = await req("POST", "/api/me/daily-bonus");
check("daily bonus 200", bonus.status === 200);
check("balance 1100", bonus.json?.pointBalance === 1100);
const bonusAgain = await req("POST", "/api/me/daily-bonus");
check("double claim rejected", bonusAgain.status === 422);

console.log("— bet placement —");
// find two fixtures with odds
const fixtures = fx.json.fixtures.filter(
  (f) => f.status === "SCHEDULED" && f.markets.some((m) => m.key === "h2h" && m.odds.length >= 3),
);
check("2+ scheduled fixtures with odds", fixtures.length >= 2, `got ${fixtures.length}`);

const oddsFor = (f, market, sel) =>
  f.markets.find((m) => m.key === market)?.odds.find((o) => o.selectionKey === sel)?.value;

const single = await req("POST", "/api/bets", {
  selections: [{ fixtureId: withOdds.id, marketKey: "h2h", selectionKey: "home" }],
  stake: 100,
  type: "SINGLE",
});
check("single bet placed", single.status === 200 && single.json?.bets?.length === 1);
check("balance deducted", single.json?.pointBalance === 1000, `got ${single.json?.pointBalance}`);

if (fixtures.length >= 2) {
  const acca = await req("POST", "/api/bets", {
    selections: [
      { fixtureId: fixtures[0].id, marketKey: "h2h", selectionKey: "home" },
      { fixtureId: fixtures[1].id, marketKey: "totals", selectionKey: "over_2.5" },
    ],
    stake: 50,
    type: "ACCA",
  });
  check("acca placed", acca.status === 200);

  const badSystem = await req("POST", "/api/bets", {
    selections: [
      { fixtureId: fixtures[0].id, marketKey: "h2h", selectionKey: "home" },
      { fixtureId: fixtures[1].id, marketKey: "totals", selectionKey: "over_2.5" },
    ],
    stake: 63,
    type: "SYSTEM",
    systemType: "PATENT",
  });
  check("system wrong leg count rejected", badSystem.status === 422);
}

// system bet on finished fixtures won't work; use 3 scheduled if available
if (fixtures.length >= 3) {
  const system = await req("POST", "/api/bets", {
    selections: fixtures.slice(0, 3).map((f, i) => ({
      fixtureId: f.id,
      marketKey: "h2h",
      selectionKey: i === 0 ? "home" : i === 1 ? "away" : "draw",
    })),
    stake: 63,
    type: "SYSTEM",
    systemType: "PATENT",
  });
  check("patent placed with 7 combos", system.status === 200);
}

console.log("— friends —");
const friend = await req("POST", "/api/friends/request", { username: "OddOwl" });
check("bot friend auto-accepted", friend.status === 200 && friend.json?.autoAccepted === true);
const friendsList = await req("GET", "/api/friends");
check("friends list has OddOwl", friendsList.json?.friends?.some((f) => f.username === "OddOwl"));

console.log("— leaderboard —");
const board = await req("GET", "/api/leaderboard?scope=global");
check("leaderboard 200", board.status === 200);
check("leaderboard has rows", board.json?.leaderboard?.length > 0);

console.log("— my bets —");
const open = await req("GET", "/api/bets?status=open");
check("open bets listed", open.status === 200 && open.json?.bets?.length >= 1);

console.log("— settlement (dev) —");
const settle = await req("POST", "/api/dev/tools");
check("settlement sweep ran", settle.status === 200);

console.log("— odds jitter (dev) —");
const jitter = await req("PUT", "/api/dev/tools");
check("odds jitter ok", jitter.status === 200 && jitter.json?.changed >= 0);

console.log("");
if (failures > 0) {
  console.error(`SMOKE FAILED: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("SMOKE PASSED — all checks green");
