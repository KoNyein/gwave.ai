import { chromium } from "@playwright/test";
const DIR = "/tmp/claude-0/-home-user-gwave-ai/7a6efcf6-5ca1-50b9-b819-c4c4a116381e/scratchpad";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const res = await page.goto("http://127.0.0.1:3111/menu", { waitUntil: "domcontentloaded", timeout: 120000 });
console.log("status:", res.status(), "url:", page.url());
await page.waitForTimeout(1500);
await page.screenshot({ path: `${DIR}/menu.png`, fullPage: true });
console.log("cards:", await page.locator("a.group").count());
console.log("ERRORS:", errors.slice(0,4));
await browser.close();
