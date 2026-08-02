const { chromium } = require("@playwright/test");
const path = require("path");

(async () => {
  const [, , input, output, mode] = process.argv;
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  await page.goto("file://" + path.resolve(input), { waitUntil: "networkidle" });
  if (mode === "png") {
    await page.screenshot({ path: output, fullPage: true });
  } else {
    await page.pdf({
      path: output,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
      headerTemplate:
        '<div style="width:100%;font-size:7pt;font-family:DejaVu Sans,Arial,sans-serif;' +
        'color:#94a3b8;padding:0 14mm;display:flex;justify-content:space-between;">' +
        '<span>Gwave — System Design &amp; Architecture</span>' +
        '<span class="title"></span></div>',
      footerTemplate:
        '<div style="width:100%;font-size:7pt;font-family:DejaVu Sans,Arial,sans-serif;' +
        'color:#94a3b8;padding:0 14mm;display:flex;justify-content:space-between;">' +
        '<span>gwave.cc · confidential</span>' +
        '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    });
  }
  await browser.close();
  console.log("wrote", output);
})();
