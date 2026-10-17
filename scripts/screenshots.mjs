// README screenshots from a local build: npm run build && npm run preview, then npm run shots
import { chromium } from "@playwright/test"
const BASE = "http://localhost:4173/"
const EXAM = "DSPSC-PRE26-10170937"
const out = (n) => `docs/media/${n}.jpg`
const browser = await chromium.launch({ channel: "chrome" })
async function page({ theme = "light", lang = "en", w = 1280, h = 800, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 3 : 2, isMobile: mobile, hasTouch: mobile, colorScheme: theme })
  await ctx.addInitScript(([t, l]) => { localStorage.setItem("mohar.theme", t); localStorage.setItem("mohar.lang", l) }, [theme, lang])
  return ctx.newPage()
}
const settle = async (p) => { await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(2500) }
const shot = (p, n) => p.screenshot({ path: out(n), type: "jpeg", quality: 82 })

let p = await page({ theme: "light" }); await p.goto(BASE); await settle(p); await shot(p, "home"); await p.close()

p = await page({ theme: "dark" }); await p.goto(`${BASE}?exam=${EXAM}`); await settle(p); await shot(p, "exam")
await p.getByRole("button", { name: /view evidence/i }).first().click(); await p.waitForTimeout(1200); await shot(p, "evidence"); await p.close()
p = await page({ theme: "light" }); await p.goto(`${BASE}?issue=1`); await settle(p); await shot(p, "issuer"); await p.close()
p = await page({ theme: "light", lang: "hi", w: 390, h: 844, mobile: true }); await p.goto(`${BASE}?exam=${EXAM}`); await settle(p); await shot(p, "exam-hindi-phone"); await p.close()
p = await page({ theme: "light" }); await p.goto(`${BASE}check.html?exam=${EXAM}`); await settle(p); await shot(p, "check"); await p.close()
await browser.close()
