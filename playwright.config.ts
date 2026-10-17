import { defineConfig, devices } from "@playwright/test"

// runs the production build in the system Chrome against live Tiramisu data (read-only, nothing is written)
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: 1,
  workers: 2,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4174", channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: { command: "npx vite preview --port 4174 --strictPort", url: "http://localhost:4174", reuseExistingServer: true },
})
