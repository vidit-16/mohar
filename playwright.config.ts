import { defineConfig, devices } from "@playwright/test"

// runs the production build in the system Chrome against live Tiramisu data (read-only, nothing is written)
export default defineConfig({
  testDir: "test/e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: 1,
  workers: 2,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4174", channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  // E2E_BASE_URL=https://mohar.live runs the same suite against production
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npx vite preview --port 4174 --strictPort", url: "http://localhost:4174", reuseExistingServer: true },
})
