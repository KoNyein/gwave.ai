import { expect, test } from "@playwright/test";

/**
 * Smoke suite: runs against any environment (even a dummy Supabase URL) —
 * verifies routing, auth guards, public pages and security headers.
 */

test("root redirects unauthenticated visitors to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("login page renders the auth form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("input[type=email]")).toBeVisible();
  await expect(page.locator("input[type=password]")).toBeVisible();
});

test("register page renders", async ({ page }) => {
  await page.goto("/register");
  await expect(page.locator("input[type=email]")).toBeVisible();
});

test("protected routes bounce to login with redirectTo", async ({ page }) => {
  for (const path of ["/feed", "/tools", "/farm", "/pos", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?redirectTo=`));
  }
});

test("membership pricing page is public", async ({ page }) => {
  await page.goto("/membership");
  await expect(
    page.getByRole("heading", { name: /membership/i }),
  ).toBeVisible();
  // Plan cards render when a real database is connected.
});

test("openapi spec is served", async ({ request }) => {
  const response = await request.get("/api/v1/openapi.json");
  expect(response.ok()).toBeTruthy();
  const spec = await response.json();
  expect(spec.openapi).toBe("3.1.0");
  expect(Object.keys(spec.paths)).toContain("/strains");
});

test("public API rejects requests without a key", async ({ request }) => {
  const response = await request.get("/api/v1/posts");
  expect(response.status()).toBe(401);
});

test("security headers are present", async ({ request }) => {
  const response = await request.get("/login");
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["strict-transport-security"]).toContain("max-age=");
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health");
  // 200 with a real database, 503 (degraded) with a dummy one — both mean
  // the app itself is alive and the probe works.
  expect([200, 503]).toContain(response.status());
  const body = await response.json();
  expect(body.status).toMatch(/ok|degraded/);
});

test("social-shell pages require login", async ({ page }) => {
  // These redirect via the shell layout / their own auth check rather than
  // the middleware prefix list. /restricted is only shown to signed-in
  // minors, so anonymous visitors bounce to /login too.
  for (const path of [
    "/learn",
    "/learn/live",
    "/learn/teach",
    "/games",
    "/wellness",
    "/settings",
    "/profile",
    "/restricted",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("dashboards and tools sub-pages are guarded", async ({ page }) => {
  for (const path of [
    "/tools/qr",
    "/tools/vpd",
    "/farm/devices",
    "/farm/rules",
    "/admin/moderation",
    "/admin/users",
    "/dev",
    "/pos/inventory",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});
