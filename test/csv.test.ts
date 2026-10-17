import { describe, expect, it } from "vitest"
import { parsePaperCsv } from "../src/lib/csv"

describe("parsePaperCsv", () => {
  it("groups questions by set in paper order, bilingual included", () => {
    const csv = 'set,question\nA-en,One?\nA-hi,एक?\nA-en,"Two, with a comma?"\nA-hi,"""quoted"" दो?"'
    expect(parsePaperCsv(csv)).toEqual([
      { code: "A-en", questions: ["One?", "Two, with a comma?"] },
      { code: "A-hi", questions: ["एक?", '"quoted" दो?'] },
    ])
  })
  it("accepts a byte-order mark, CRLF and blank lines", () => {
    expect(parsePaperCsv("\uFEFFSet, Question\r\n\r\nB,x\r\n")).toEqual([{ code: "B", questions: ["x"] }])
  })
  it("rejects a missing header, bad set codes, empty questions and empty files", () => {
    expect(() => parsePaperCsv("A,q")).toThrow(/First line/)
    expect(() => parsePaperCsv("set,question\nbad code!,q")).toThrow(/set code/)
    expect(() => parsePaperCsv("set,question\nA,")).toThrow(/empty question/)
    expect(() => parsePaperCsv("set,question\n")).toThrow(/No questions/)
    expect(() => parsePaperCsv("set,question\n,q")).toThrow(/expected/)
  })
})
