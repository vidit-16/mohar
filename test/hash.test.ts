import { describe, expect, it } from "vitest"
import { createHash } from "node:crypto"
import { commitHash, normalise, questionHash, rootHash, splitQuestions } from "../src/lib/hash"

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

describe("Hindi question numbering", () => {
  const plain = "किस नदी को दक्षिण गंगा कहा जाता है?"
  it.each(["प्रश्न 1. ", "प्रश्न १। ", "प्र. 3) ", "प्र 12 ", "(४) ", "१. ", "Q No. 7: ", "No. 7) "])("strips %j", (prefix) => {
    expect(questionHash(prefix + plain)).toBe(questionHash(plain))
  })
  it("keeps a number that is part of the question", () => {
    expect(normalise("1857 का विद्रोह कहाँ शुरू हुआ?")).toBe("1857 का विद्रोह कहाँ शुरू हुआ")
  })
})

describe("numbering edge cases", () => {
  it.each([
    ["प्रश्न3. गंगा नदी कहाँ से निकलती है?", "गंगा नदी कहाँ से निकलती है"],
    ["प्र.3 गंगा नदी", "गंगा नदी"],
    ["प्र. 3 गंगा नदी", "गंगा नदी"],
    ["Q no.4 which river", "which river"],
    ["Q no 4 which river", "which river"],
    ["Question No. 12) which river", "which river"],
  ])("%s", (input, want) => expect(normalise(input)).toBe(want))
})

describe("rootHash", () => {
  it("is sha256 over the commits joined with nothing in between", () => {
    const commits = [commitHash("0x01", "a"), commitHash("0x02", "b")]
    expect(rootHash(commits)).toBe("0x" + createHash("sha256").update(commits.join(""), "utf8").digest("hex"))
  })
})
