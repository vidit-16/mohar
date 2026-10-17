import { defineConfig } from "vitest/config"

// hits the live Tiramisu RPC; set ARKIV_KEY in .env so it doesn't eat the keyless read budget
export default defineConfig({
  test: {
    include: ["test/chain/*.test.ts"],
    setupFiles: ["dotenv/config"],
    testTimeout: 60_000,
    fileParallelism: false,
  },
})
