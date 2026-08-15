/** Screenshot a URL at desktop + mobile sizes for design study. */
const puppeteer = require("/home/ubuntu/ai-website-cloner-template/node_modules/puppeteer-core");
const URL_TO_SHOT = process.argv[2] ?? "https://www.betclic.fr/";
const OUT = process.argv[3] ?? "/tmp/opencode/shot";

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/snap/bin/chromium",
    headless: "shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  try {
    await page.goto(URL_TO_SHOT, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({ path: `${OUT}-desktop.png`, fullPage: false });
    console.log("desktop shot saved");
  } catch (e) {
    console.log("desktop failed:", e.message);
  }
  await page.setViewport({ width: 390, height: 844 });
  try {
    await page.goto(URL_TO_SHOT, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({ path: `${OUT}-mobile.png`, fullPage: false });
    console.log("mobile shot saved");
  } catch (e) {
    console.log("mobile failed:", e.message);
  }
  await browser.close();
})();
