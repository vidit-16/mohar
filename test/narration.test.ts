import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import NARRATION from "../src/ui/narration.json"
import { STEPS } from "../src/ui/tourSteps"

// a tour line changed without re-recording would play the old words; scripts/narration.ts fixes it
describe("tour narration", () => {
  for (const lang of ["en", "hi"] as const)
    it(`every ${lang} line has its own recorded clip`, () => {
      expect(NARRATION[lang]).toHaveLength(STEPS.length)
      STEPS.forEach((s, i) => {
        const hash = createHash("sha256").update(s[lang]).digest("hex").slice(0, 8)
        expect(NARRATION[lang][i]).toBe(`${lang}-${String(i).padStart(2, "0")}-${hash}.mp3`)
        expect(existsSync(`public/tour/${NARRATION[lang][i]}`)).toBe(true)
      })
    })
})
