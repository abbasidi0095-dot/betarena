/** Probe the app through the tunnel for the reported error. */
const BASE = process.env.BASE ?? "http://localhost:3100";
let cookie = "";

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text: text.slice(0, 200) };
}

const s = Date.now();
console.log("register...");
const reg = await req("POST", "/api/auth/register", {
  username: `probe_${s}`,
  email: `probe_${s}@t.local`,
  password: "password123",
});
console.log("  register:", reg.status, reg.json?.user?.pointBalance ?? reg.text);

const fx = await req("GET", "/api/fixtures?scope=upcoming");
const fixtures = (fx.json?.fixtures ?? []).filter(
  (f) => f.markets.some((m) => m.key === "h2h" && m.odds.length >= 3),
);
console.log("  fixtures:", fx.status, fixtures.length);

if (fixtures.length >= 2) {
  console.log("place single...");
  const bet = await req("POST", "/api/bets", {
    selections: [{ fixtureId: fixtures[0].id, marketKey: "h2h", selectionKey: "home" }],
    stake: 50,
    type: "SINGLE",
  });
  console.log("  bet:", bet.status, bet.json?.pointBalance ?? bet.text);

  console.log("place acca...");
  const acca = await req("POST", "/api/bets", {
    selections: [
      { fixtureId: fixtures[0].id, marketKey: "h2h", selectionKey: "home" },
      { fixtureId: fixtures[1].id, marketKey: "totals", selectionKey: "over_2.5" },
    ],
    stake: 50,
    type: "ACCA",
  });
  console.log("  acca:", acca.status, acca.json?.pointBalance ?? acca.text);
}

console.log("bonus...");
const bonus = await req("POST", "/api/me/daily-bonus");
console.log("  bonus:", bonus.status, bonus.json?.pointBalance ?? bonus.text);

console.log("open bets...");
const bets = await req("GET", "/api/bets?status=open");
console.log("  bets:", bets.status, bets.json?.bets?.length ?? bets.text);

console.log("leaderboard...");
const lb = await req("GET", "/api/leaderboard?scope=global");
console.log("  lb:", lb.status, lb.json?.leaderboard?.length ?? lb.text);

console.log("friends...");
const fr = await req("GET", "/api/friends");
console.log("  friends:", fr.status, fr.json?.friends?.length ?? fr.text);
