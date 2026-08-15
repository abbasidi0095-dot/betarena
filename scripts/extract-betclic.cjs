/** Extract Betclic design tokens from the live site: colors, fonts, layout structure. */
const puppeteer = require("/home/ubuntu/ai-website-cloner-template/node_modules/puppeteer-core");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/snap/bin/chromium",
    headless: "shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto("https://www.betclic.fr/football", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 5000));

  const data = await page.evaluate(() => {
    const els = [...document.querySelectorAll("body *")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const colors = new Map();
    const fonts = new Map();
    for (const el of els) {
      const cs = getComputedStyle(el);
      if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
        const k = cs.backgroundColor;
        colors.set(k, (colors.get(k) ?? 0) + el.getBoundingClientRect().width * el.getBoundingClientRect().height);
      }
      if (cs.color !== "rgb(0, 0, 0)") {
        const k = cs.color;
        colors.set(k, (colors.get(k) ?? 0) + 1);
      }
      if (cs.fontFamily && cs.fontFamily.length > 3) {
        const k = cs.fontFamily.split(",")[0];
        fonts.set(k, (fonts.get(k) ?? 0) + 1);
      }
    }
    const topColors = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([c, v]) => `${c} (${Math.round(v)})`);
    const topFonts = [...fonts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) => `${c} (${v})`);

    // Find a match card-like structure: rows with several buttons
    const buttons = [...document.querySelectorAll("button, [role=button], [class*=odd], [class*=cote]")]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 40 && r.height > 25;
      })
      .slice(0, 8)
      .map((b) => ({
        text: b.innerText.slice(0, 20).replace(/\s+/g, " "),
        cls: (b.className?.baseVal ?? b.className ?? "").toString().slice(0, 120),
        bg: getComputedStyle(b).backgroundColor,
        color: getComputedStyle(b).color,
        radius: getComputedStyle(b).borderRadius,
      }));

    const header = document.querySelector("header, [class*=header]");
    const headerBg = header ? getComputedStyle(header).backgroundColor : "none";

    return { topColors, topFonts, buttons, headerBg };
  });

  console.log("=== TOP COLORS (bg+fg by area) ===");
  console.log(data.topColors.join("\n"));
  console.log("\n=== FONTS ===");
  console.log(data.topFonts.join("\n"));
  console.log("\n=== ODDS BUTTONS ===");
  console.log(JSON.stringify(data.buttons, null, 1));
  console.log("\n=== HEADER BG ===", data.headerBg);
  await browser.close();
})();
