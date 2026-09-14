import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { browserName: "chromium" }, dependencies: ["setup"] },
  ],
  use: {
    baseURL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
  },
  webServer: process.env.CI
    ? { command: "pnpm start", url: "http://localhost:3000", reuseExistingServer: false }
    : undefined,
});
