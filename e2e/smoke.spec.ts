import { expect, type Page, test } from "@playwright/test"

const HELD = "/?exam=DSPSC-PRE26-10170937"
const UPCOMING = "/?exam=DSPSC-PRE26-U10170941"
const OPEN = "/?exam=open-demo-mock-test-open-exam-e96c10"
const LEAK_WITNESS = "0x518da20dea6de595ad70e631b9263b6d154ad18f235e77c0869be83fc7429d6a"

const errors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const list: string[] = []
  errors.set(page, list)
  page.on("pageerror", (e) => list.push(e.message))
  page.on("console", (m) => m.type() === "error" && list.push(m.text()))
  // start every test from defaults once, without undoing choices a test makes before a reload
  await page.addInitScript(() => {
    if (sessionStorage.getItem("e2e.fresh")) return
    sessionStorage.setItem("e2e.fresh", "1")
    localStorage.setItem("mohar.lang", "en")
    localStorage.removeItem("mohar.theme")
  })
})
test.afterEach(async ({ page }) => {
  expect(errors.get(page), "console errors").toEqual([])
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0)
})

test("landing shows the pitch, the seal and live exams", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Prove who had the paper")
  await expect(page.getByRole("img", { name: "Mohar seal" })).toBeVisible()
  await expect(page.getByRole("link", { name: /See a leak get caught/ })).toBeVisible()
  await expect(page.locator(".exam-row")).toHaveCount(2)
  await page.getByRole("tab", { name: /Open exams/ }).click()
  await expect(page.getByText("Demo Mock Test, Open Exam")).toBeVisible()
  await expect(page.locator(".net code")).toHaveText(/#\d+/, { timeout: 30_000 }).catch(async () => {
    // on phones the block number is hidden and only the status dot shows
    await expect(page.locator(".net i")).toBeVisible()
  })
})

test("language and theme switch and stick", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "हिं" }).click()
  await expect(page.getByRole("heading", { level: 1 })).toContainText("पेपर")
  await page.getByRole("button", { name: /Switch to (light|dark) mode/ }).click()
  const theme = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.reload()
  await expect(page.getByRole("heading", { level: 1 })).toContainText("पेपर")
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme)
})

test("held exam shows the leak, the seal check and the forged seal", async ({ page }) => {
  await page.goto(HELD)
  await expect(page.locator(".meaning")).toContainText("3 real questions")
  await expect(page.locator(".stat").nth(2)).toContainText("10/10")
  await expect(page.locator(".stat").nth(3)).toContainText("1")
  await expect(page.locator(".tl-dot")).toHaveCount(2)
  await expect(page.locator(".pq.hit")).toHaveCount(3)
  await expect(page.locator(".live")).toContainText("Connected")
  await page.getByRole("button", { name: "View evidence" }).click()
  const drawer = page.getByRole("dialog", { name: "Witness evidence" })
  await expect(drawer).toContainText("Held 3 real questions before the exam")
  await expect(drawer.locator(".match-list li")).toHaveCount(3)
  await page.keyboard.press("Escape")
  await expect(drawer).toBeHidden()
})

test("a shared evidence link opens the drawer directly", async ({ page }) => {
  await page.goto(`${HELD}&w=${LEAK_WITNESS}`)
  await expect(page.getByRole("dialog", { name: "Witness evidence" })).toContainText("A-Q2")
})

test("technical details toggle reveals chain data", async ({ page }) => {
  await page.goto(HELD)
  await expect(page.locator(".wrow").first()).toBeVisible()
  await expect(page.locator(".tech-only").first()).toBeHidden()
  await page.getByText("Technical details").click()
  await expect(page.locator(".wrow .tech-only").first()).toContainText("#")
})

test("witness sheet hashes on the device before anything is sent", async ({ page }) => {
  await page.goto(UPCOMING)
  await page.getByRole("button", { name: "Witness a leak" }).click()
  await page.getByRole("dialog").locator("textarea").fill("Q1. Which river is known as the Dakshin Ganga?\nQ2. Something made up")
  await expect(page.getByText("2 questions found")).toBeVisible()
  await page.getByRole("button", { name: "Next" }).click()
  await expect(page.locator(".hash-list li")).toHaveCount(2)
  await expect(page.locator(".hash-list code").first()).toHaveText(/^0x[0-9a-f]{16}…$/)
  await expect(page.locator(".wallet-card")).toBeVisible()
})

test("open exam checks witnesses against a pasted official paper", async ({ page }) => {
  await page.goto(OPEN)
  await page.locator("[data-tour=check] textarea").fill("Q1) Which planet is known as the RED planet\nQ2. Who is known as the Missile Man of India?")
  await page.getByRole("button", { name: "Check witnesses" }).click()
  await expect(page.locator(".meaning")).toContainText("1 witness held real questions")
  await expect(page.locator(".wrow").first()).toContainText("Leak · 1/2")
})

test("an unknown exam id is handled, not crashed", async ({ page }) => {
  await page.goto("/?exam=does-not-exist-123")
  await expect(page.getByText("No official seal for this exam")).toBeVisible()
})

test("the tour runs, opens evidence and can be exited", async ({ page }) => {
  await page.goto("/?tour=1&step=0")
  await expect(page.locator(".tour-spot")).toBeVisible()
  await expect(page.locator(".tour-text")).toContainText("leaked paper")
  await page.keyboard.press("ArrowRight")
  await expect(page).toHaveURL(/step=1/)
  await page.goto(`${HELD}&tour=1&step=8`)
  await expect(page.getByRole("dialog", { name: "Witness evidence" })).toBeVisible()
  await expect(page.locator(".tour-spot")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page).not.toHaveURL(/tour=1/)
})
