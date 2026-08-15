/** Verify: clicking odds adds to slip WITHOUT opening it; FAB shows count. */
const puppeteer = require("/home/ubuntu/ai-website-cloner-template/node_modules/puppeteer-core");

(async () => {
  const BASE = process.env.BASE ?? "http://localhost:3100";
  const suffix = Date.now();
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: `fab_${suffix}`,
      email: `fab_${suffix}@t.local`,
      password: "password123",
    }),
  });
  const cookie = reg.headers.get("set-cookie").split(";")[0];

  const browser = await puppeteer.launch({
    executablePath: "/snap/bin/chromium",
    headless: "shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.setCookie({
    name: "betarena_token",
    value: cookie.split("=")[1],
    domain: new URL(BASE).hostname,
    path: "/",
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 2000));

  // click the first odds button (contains a number like 1.77)
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const oddsBtn = btns.find((b) => /^\d\.\d{2}$/.test(b.textContent.trim()));
    if (!oddsBtn) return "no-odds-button";
    oddsBtn.click();
    return oddsBtn.textContent.trim();
  });
  console.log("clicked odds:", clicked);
  await new Promise((r) => setTimeout(r, 800));

  const state = await page.evaluate(() => {
    const fab = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Bet slip"),
    );
    const drawerOpen = !!document.querySelector('aside[class*="max-h-[88vh]"]');
    const fabCount = fab?.textContent.replace(/\D/g, "") ?? null;
    return { drawerOpen, fabCount, fabVisible: !!fab };
  });
  console.log("slip drawer open:", state.drawerOpen, "| FAB count:", state.fabCount, "| FAB visible:", state.fabVisible);
  console.log("page errors:", errs.length ? errs : "none");

  // click a second odds button — still no auto-open
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const oddsBtn = btns.find((b) => /^\d\.\d{2}$/.test(b.textContent.trim()) && !b.classList.contains("bg-betclic-red"));
    if (oddsBtn) oddsBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  const after2 = await page.evaluate(() => {
    const fab = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Bet slip"),
    );
    const drawerOpen = !!document.querySelector('aside[class*="max-h-[88vh]"]');
    return { drawerOpen, fabCount: fab?.textContent.replace(/\D/g, "") ?? null };
  });
  console.log("after 2nd add — drawer open:", after2.drawerOpen, "| FAB count:", after2.fabCount);

  await browser.close();
  process.exit(errs.length || state.drawerOpen ? 1 : 0);
})();
