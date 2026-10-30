import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { DICT } from "../src/i18n"
import { withShell } from "../src/ui/Shell"

const html = readFileSync("index.html", "utf8")

describe("first-paint shell", () => {
  it("is what scripts/shell.ts writes from the real components (run npm run build to refresh it)", () => {
    expect(withShell(html)).toBe(html)
  })

  it("shows the current headline and seal, not an old one", () => {
    expect(html).toContain(`<h1>${DICT.en["hero.title"]}</h1>`)
    expect(html).not.toContain("M-22 6c0-14")
  })
})
