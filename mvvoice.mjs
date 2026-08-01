import { chromium } from "@playwright/test";

const DIR = "/tmp/claude-0/-home-user-gwave-ai/7a6efcf6-5ca1-50b9-b819-c4c4a116381e/scratchpad";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: [
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
await ctx.grantPermissions(["microphone"]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));

await page.goto("http://127.0.0.1:3111/metaverse", {
  waitUntil: "domcontentloaded",
  timeout: 90000,
});
await page.waitForTimeout(16000);

// Voice panel ဖွင့် — guest ဖြစ်လို့ server က "auth" နဲ့ ငြင်းရမယ်
await page.getByRole("button", { name: /🎙/ }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${DIR}/v1-panel.png` });
await page.getByRole("button", { name: /အသံခန်းထဲ ဝင်မယ်/ }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${DIR}/v2-denied.png` });
console.log("auth denial:", await page.locator("text=အကောင့်နဲ့ ဝင်ထားမှ").count());
console.log("ERRORS:", errors.slice(0, 6));
await browser.close();
