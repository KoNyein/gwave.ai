import { expect, test } from "@playwright/test";

/**
 * Full user flows — require a REAL local Supabase stack with migrations +
 * seed applied (demo1@gwave.ai / password123). Enable with:
 *
 *   E2E_FULL=1 pnpm e2e
 */
const fullRun = process.env.E2E_FULL === "1";
test.skip(!fullRun, "Set E2E_FULL=1 with a real Supabase stack to run flows");

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", "password123");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/feed/);
}

test("post → react → comment", async ({ page }) => {
  await login(page, "demo1@gwave.ai");

  // Create a post.
  const content = `E2E post ${Date.now()}`;
  await page.getByRole("button", { name: /what's growing/i }).click();
  await page.locator("textarea").fill(content);
  await page.getByRole("button", { name: /^post$/i }).click();
  await expect(page.getByText(content)).toBeVisible();

  // React.
  const card = page.locator("div", { hasText: content }).last();
  await card.getByRole("button", { name: /like/i }).first().click();

  // Comment.
  await card.getByRole("button", { name: /comment/i }).click();
  await page.getByPlaceholder(/write a comment/i).fill("E2E comment");
  await page.keyboard.press("Enter");
  await expect(page.getByText("E2E comment")).toBeVisible();
});

test("search a strain from the navbar", async ({ page }) => {
  await login(page, "demo1@gwave.ai");
  await page.getByRole("combobox").fill("Blue Dream");
  await expect(page.getByText(/blue dream/i).first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/strains\//);
});

test("POS: open shift and complete a cash sale", async ({ page }) => {
  await login(page, "demo1@gwave.ai");
  await page.goto("/pos");
  // Assumes a store with at least one product and no open shift.
  if (await page.getByLabel(/opening float/i).isVisible()) {
    await page.getByLabel(/opening float/i).fill("50");
    await page.getByRole("button", { name: /open shift/i }).click();
  }
  await page.locator("button", { hasText: /\d+\.\d{2}/ }).first().click();
  await page.getByRole("button", { name: /charge/i }).click();
  await page.getByRole("button", { name: /confirm payment/i }).click();
  await expect(page.getByText(/sale complete/i)).toBeVisible();
});

test("developer: create an API key and call the API", async ({
  page,
  request,
}) => {
  await login(page, "demo1@gwave.ai");
  await page.goto("/dev");
  await page.getByRole("button", { name: /create key/i }).first().click();
  await page.getByLabel(/name/i).fill("e2e key");
  await page.getByRole("button", { name: /read:knowledge/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /create key/i })
    .click();
  const key = await page.locator("code").first().innerText();
  expect(key).toMatch(/^gw_/);

  const response = await request.get("/api/v1/strains?q=dream", {
    headers: { Authorization: `Bearer ${key}` },
  });
  expect(response.ok()).toBeTruthy();
});
