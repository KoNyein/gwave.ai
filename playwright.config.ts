import { defineConfig } from "@playwright/test";

/**
 * E2E config. `pnpm e2e` starts the production build and runs the smoke
 * suite. Full user-flow specs (signup → post → …) additionally need a real
 * data API: set E2E_FULL=1 plus real NEXT_PUBLIC_DATA_API_* env.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    // Allows pinned/preinstalled browsers (e.g. CI images) without
    // re-downloading: PW_CHROMIUM_PATH=/path/to/chrome pnpm e2e
    ...(process.env.PW_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
      : {}),
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm start",
        port: 3000,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
