/** Logged-in browser check: register via API, then load key pages. */
const puppeteer = require("/home/ubuntu/ai-website-cloner-template/node_modules/puppeteer-core");
const BASE = process.env.BASE ?? "http://localhost:3100";

(async () => {
  const suffix = Date.now();
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: `browser_${suffix}`,
      email: `browser_${suffix}@t.local`,
      password: "password123",
    }),
  });
  const cookie = reg.headers.get("set-cookie").split(";")[0];
  console.log("registered, cookie set");

  const browser = await puppeteer.launch({
    executablePath: "/snap/bin/chromium",
    headless: "shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const pages = ["/", "/live", "/my-bets", "/leaderboard", "/friends", "/profile", "/auth"];
  let fails = 0;
  for (const path of pages) {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 720 }); // mobile-first check
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.setCookie({
      name: "betarena_token",
      value: cookie.split("=")[1],
      domain: new URL(BASE).hostname,
      path: "/",
    });
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1200));
    const metrics = await page.evaluate(() => ({
      bodyScrollW: document.body.scrollWidth,
      innerW: window.innerWidth,
      docH: document.documentElement.scrollHeight,
      innerH: window.innerHeight,
      mainScrollable: (() => {
        const main = document.querySelector("main");
        if (!main) return false;
        return main.scrollHeight > main.clientHeight;
      })(),
    }));
    const body = await page.evaluate(() => document.body.innerText.slice(0, 40).replace(/\n/g, " | "));
    const hOverflow = metrics.bodyScrollW > metrics.innerW;
    console.log(
      `${path.padEnd(14)} errors:${errs.length ? errs.slice(0, 2) : "none"} ` +
        `noHScroll:${!hOverflow} mainScroll:${metrics.mainScrollable} body:${body}`,
    );
    if (errs.length || hOverflow) fails++;
    await page.close();
  }
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
