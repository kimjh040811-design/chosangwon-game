import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "ui.spec.ts",
  timeout: 30000,
  workers: 1,
  outputDir: "qa/integrated/results",
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:5173",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
