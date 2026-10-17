import { describe, expect, it } from "vitest"
import { commitHash, normalise, questionHash, splitQuestions } from "../src/lib/hash"

describe("normalise", () => {
  it("ignores numbering, case and punctuation", () => {
    const a = "Q4) which article of the constitution deals with the finance commission"
    const b = "4. Which Article of the Constitution deals with the Finance Commission?"
    expect(normalise(a)).toBe(normalise(b))
    expect(questionHash(a)).toBe(questionHash(b))
  })

  it("keeps Devanagari matras so different words stay different", () => {
    expect(normalise("मोहर")).toBe("मोहर")
    expect(questionHash("मोहर")).not.toBe(questionHash("मेहर"))
  })

  it("treats unicode look-alikes the same after NFKC", () => {
    expect(normalise("ＮＥＥＴ ２０２４")).toBe("neet 2024")
  })

  it("does not strip numbers that are part of the question", () => {
    expect(normalise("In 1857 who led the revolt in Jhansi?")).toBe("in 1857 who led the revolt in jhansi")
  })
})

describe("splitQuestions", () => {
  it("drops blank and punctuation-only lines", () => {
    expect(splitQuestions("Q1. one\n\n  ---  \nQ2. two\r\n")).toEqual(["Q1. one", "Q2. two"])
  })
})

describe("commitHash", () => {
  it("depends on the salt, so a sealed question can't be guessed from the commit", () => {
    const q = "Which river is known as the Dakshin Ganga?"
    expect(commitHash("0x01", q)).not.toBe(commitHash("0x02", q))
    expect(commitHash("0x01", q)).not.toBe(questionHash(q))
  })
})
