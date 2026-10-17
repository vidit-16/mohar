import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { normalise, questionHash, splitQuestions } from "../src/lib/hash"
// @ts-expect-error plain JS on purpose, it has to run with zero dependencies
import * as standalone from "../verify.mjs"

// verify.mjs re-implements the rules so it can run without this repo; it must never drift from the app
const corpus = [
  "Q4) which article of the constitution deals with the finance commission",
  "4. Which Article of the Constitution deals with the Finance Commission?",
  "(12) Who was the first Chief Election Commissioner of India?",
  "Question 7: The Loktak lake is located in which state?",
  "In 1857 who led the revolt in Jhansi?",
  "मोहर", "मेहर", "भारत का पहला उपग्रह कौन सा था?", "प्रश्न 3. गंगा नदी कहाँ से निकलती है?",
  "ＮＥＥＴ ２０２４ — paper", "café   naïve\tresume", "😀 emoji only?", "   ", "---", "",
  "Q1)Which planet is known as the RED planet", "A–B “quotes” and ‘apostrophes’",
]

function randomText(seed: number) {
  let x = seed
  const next = () => (x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  const ranges = [[0x20, 0x7e], [0x900, 0x97f], [0xff10, 0xff5a], [0x2000, 0x206f], [0xc0, 0x17f]]
  let s = ""
  for (let i = 0; i < 1 + Math.floor(next() * 60); i++) {
    const [a, b] = ranges[Math.floor(next() * ranges.length)]
    s += String.fromCodePoint(a + Math.floor(next() * (b - a)))
  }
  return s
}

describe("verify.mjs parity", () => {
  it("normalises the corpus exactly like the app", () => {
    for (const q of corpus) expect(standalone.normalise(q), q).toBe(normalise(q))
  })

  it("hashes the corpus exactly like the app", () => {
    for (const q of corpus) expect(standalone.sha(standalone.normalise(q)), q).toBe(questionHash(q))
  })

  it("agrees on 2000 random mixed-script strings", () => {
    for (let i = 0; i < 2000; i++) {
      const t = randomText(i + 1)
      expect(standalone.normalise(t), JSON.stringify(t)).toBe(normalise(t))
    }
  })

  it("splits a pasted paper into the same lines", () => {
    const paper = "Q1. one\n\n  ---  \r\nQ2. two\n😀\nतीन"
    expect(standalone.lines(paper)).toEqual(splitQuestions(paper))
  })
})

describe("check.html", () => {
  // the browser checker is one self-contained file, so it carries its own copy of the rules
  const src = readFileSync(new URL("../public/check.html", import.meta.url), "utf8")
  const fn = src.match(/const normalise = \(t\) =>\s*([^\n]+)/)?.[1]
  const lines = src.match(/const lines = \(t\) => ([^\n]+)/)?.[1]

  it("uses the same normaliser as the app", () => {
    expect(fn).toBeTruthy()
    const browserNormalise = new Function("t", `return ${fn}`) as (t: string) => string
    for (const s of corpus) expect(browserNormalise(s)).toBe(normalise(s))
  })

  it("splits a pasted paper the same way", () => {
    const browserNormalise = new Function("t", `return ${fn}`)
    const browserLines = new Function("normalise", "t", `return ${lines}`) as (n: unknown, t: string) => string[]
    const paper = corpus.join("\n")
    expect(browserLines(browserNormalise, paper)).toEqual(splitQuestions(paper))
  })
})
