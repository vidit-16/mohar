import { expect, test } from "./fixtures"

// The talk runs on this page, so it gets the same treatment as the rest of the site: every way a clicker or a
// keyboard can move the slides, the demo slide on an exam whose paper is already out, and the closing QR.
const STAGE = "/?stage=1&exam=DSPSC-PRE26-10170937"
const slide = (page: import("@playwright/test").Page) => page.locator(".stage-slide").getAttribute("data-slide")

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mohar.lang", "en"))
})

test("moves with the keys a clicker sends, including keys sent to the document", async ({ page }) => {
  await page.goto(STAGE)
  await expect(page.getByRole("heading", { name: "Mohar: who had the paper first?" })).toBeVisible()
  await page.keyboard.press("PageDown")
  expect(await slide(page)).toBe("problem")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Space")
  expect(await slide(page)).toBe("fight")
  await page.keyboard.press("PageUp")
  expect(await slide(page)).toBe("number")
  // some clickers and remote apps dispatch to the document, which has no element methods
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })))
  expect(await slide(page)).toBe("fight")
})

test("the demo slide shows the verdict of a revealed exam, in English and Hindi, then the QR", async ({ page }) => {
  await page.goto(STAGE)
  await expect(page.getByRole("heading", { name: "Mohar: who had the paper first?" })).toBeVisible()
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowRight")
  expect(await slide(page)).toBe("demo")
  await expect(page.locator(".stage-seal")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "Held 3 real questions" })).toBeVisible()
  await page.keyboard.press("h")
  await expect(page.getByRole("heading", { name: "3 असली प्रश्न पहले से थे" })).toBeVisible()
  await page.keyboard.press("h")
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight")
  expect(await slide(page)).toBe("thanks")
  await expect(page.getByRole("img", { name: "QR code for https://mohar.live/devcon" })).toBeVisible()
})

test("the phone remote shows the verdict once revealed and never asks for a key up front", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/?stage=remote&exam=DSPSC-PRE26-10170937")
  await expect(page.locator(".stage-seal")).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(".stage-setup")).toHaveCount(0)
})
