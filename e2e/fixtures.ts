import "dotenv/config"
import { test as base } from "@playwright/test"
import { POST as rpc } from "../api/rpc"

// vite preview has no serverless functions, so serve /api/rpc with the real handler (same code Vercel runs).
// /api/drip is stubbed: the live drip is covered by the chain tests and shouldn't spend GLM per run.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/api/rpc", async (route) => {
      const req = route.request()
      const res = await rpc(new Request("http://local/api/rpc", { method: "POST", headers: { "content-type": "application/json" }, body: req.postData() ?? "" }))
      await route.fulfill({ status: res.status, contentType: "application/json", body: await res.text() })
    })
    await page.route("**/api/drip", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"skipped":"drip is off in tests"}' }))
    await use(page)
  },
})
export { expect } from "@playwright/test"
