import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const pages = [
  ["home", "/"],
  ["held exam", "/?exam=DSPSC-PRE26-10170937"],
  ["upcoming exam", "/?exam=DSPSC-PRE26-U10170941"],
  ["open exam", "/?exam=open-demo-mock-test-open-exam-e96c10"],
  ["issuer console", "/?issue=1"],
  ["evidence drawer", "/?exam=DSPSC-PRE26-10170937&w=0x518da20dea6de595ad70e631b9263b6d154ad18f235e77c0869be83fc7429d6a"],
] as const

async function audit(page: Page, label: string) {
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish() } catch { /* infinite pulse */ } }))
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  const summary = violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`)
  expect(summary, label).toEqual([])
}

for (const theme of ["light", "dark"] as const) {
  for (const lang of ["en", "hi"] as const) {
    test.describe(`${theme} / ${lang}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript(([t, l]) => {
          localStorage.setItem("mohar.theme", t)
          localStorage.setItem("mohar.lang", l)
        }, [theme, lang])
      })
      for (const [label, url] of pages) {
        test(label, async ({ page }) => {
          await page.goto(url)
          await page.waitForLoadState("networkidle")
          await page.waitForTimeout(1500)
          await audit(page, `${label} ${theme} ${lang}`)
        })
      }
      test("witness sheet", async ({ page }) => {
        await page.goto("/?exam=DSPSC-PRE26-U10170941")
        await page.locator("[data-tour=witness-btn]").click()
        await page.getByRole("dialog").locator("textarea").fill("Q1. Which river is known as the Dakshin Ganga?")
        await audit(page, `witness sheet ${theme} ${lang}`)
      })
    })
  }
}
