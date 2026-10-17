import { describe, expect, it } from "vitest"
import { DICT } from "../src/i18n"
import { STEPS } from "../src/ui/tourSteps"

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe("translations", () => {
  it("Hindi has every English key and nothing extra", () => {
    expect(Object.keys(DICT.hi).sort()).toEqual(Object.keys(DICT.en).sort())
  })

  it("every string is filled in", () => {
    for (const lang of ["en", "hi"] as const) for (const [k, v] of Object.entries(DICT[lang])) expect(v.trim(), `${lang}.${k}`).not.toBe("")
  })

  it("Hindi strings use the same placeholders, except English-only plural words", () => {
    const englishOnly = new Set(["qs", "ws", "fps"])
    for (const k of Object.keys(DICT.en) as (keyof typeof DICT.en)[]) {
      const en = vars(DICT.en[k]).filter((v) => !englishOnly.has(v))
      expect(vars(DICT.hi[k]).filter((v) => !englishOnly.has(v)), k).toEqual(en)
    }
  })

  it("Hindi is actually Hindi for the main sentences", () => {
    for (const k of ["hero.lead", "how.2.d", "mean.leak", "w.private"] as const) expect(DICT.hi[k]).toMatch(/[\u0900-\u097F]/)
  })

  it("every tour step has both languages and a target or is the end card", () => {
    for (const [i, s] of STEPS.entries()) {
      expect(s.en.trim(), `step ${i}`).not.toBe("")
      expect(s.hi, `step ${i}`).toMatch(/[\u0900-\u097F]/)
      expect(Boolean(s.target) || s.end, `step ${i}`).toBe(true)
    }
    expect(STEPS.at(-1)?.end).toBe(true)
  })
})
