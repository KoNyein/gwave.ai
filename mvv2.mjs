import { chromium } from "@playwright/test";
const DIR = "/tmp/claude-0/-home-user-gwave-ai/7a6efcf6-5ca1-50b9-b819-c4c4a116381e/scratchpad";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-sandbox","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"],
});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
await ctx.grantPermissions(["microphone"]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
await page.goto("http://127.0.0.1:3111/metaverse", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(20000);
const btns = await page.locator("button").allTextContents();
console.log("buttons:", JSON.stringify(btns));
await page.screenshot({ path: `${DIR}/v0-all.png` });
console.log("ERRORS:", errors.slice(0,5));
await browser.close();
