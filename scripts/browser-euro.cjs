/** Verify stake input: typing 100 shows 100 (no 0100), and euro labels render. */
const puppeteer = require("/home/ubuntu/ai-website-cloner-template/node_modules/puppeteer-core");

(async () => {
  const BASE = process.env.BASE ?? "http://localhost:3100";
  const suffix = Date.now();
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: `eur_${suffix}`,
      email: `eur_${suffix}@t.local`,
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

  // header balance shows euro
  const headerEuro = await page.evaluate(() => document.body.innerText.includes("€1,000"));

  // add a selection (FAB button), open slip
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const oddsBtn = btns.find((b) => /^\d\.\d{2}$/.test(b.textContent.trim()));
    if (oddsBtn) oddsBtn.click();
  });
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => {
    const fab = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Bet slip"));
    if (fab) fab.click();
  });
  await new Promise((r) => setTimeout(r, 900));

  // type "100" character by character into the stake input
  const typed = await page.evaluate(async () => {
    const input = document.querySelector('input[inputmode="numeric"]');
    if (!input) return "no-input";
    const setVal = (v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setVal("1");
    await new Promise((r) => setTimeout(r, 60));
    setVal("10");
    await new Promise((r) => setTimeout(r, 60));
    setVal("100");
    await new Promise((r) => setTimeout(r, 60));
    return input.value;
  });
  console.log("stake input after typing 1,10,100:", JSON.stringify(typed), typed === "100" ? "OK-no-leading-zero" : "BUG");

  // clear-all then type 100 (the old 0100 repro)
  await page.evaluate(async () => {
    const input = document.querySelector('input[inputmode="numeric"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "100");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 300));
  const finalVal = await page.evaluate(() => document.querySelector('input[inputmode="numeric"]').value);
  console.log("direct set 100 →", JSON.stringify(finalVal));

  const slipText = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    return aside?.innerText.replace(/\s+/g, " ").slice(0, 300);
  });
  console.log("slip shows euro:", slipText?.includes("€") ?? false);
  console.log("header shows €1,000:", headerEuro);
  console.log("errors:", errs.length ? errs : "none");
  await browser.close();
})();
