import { describe, expect, it } from "vitest"
import { commitHash, questionHash, rootHash } from "../src/lib/hash"
import { deadlineOf, judge, openExamFrom, openReveals, pastedPaper, type Row } from "../src/lib/rules"

const row = (over: Partial<Row>): Row => ({
  key: "0xk",
  creator: "0x0000000000000000000000000000000000000001",
  owner: "0x0000000000000000000000000000000000000001",
  createdAt: 1n,
  expiresAt: 100n,
  readonly: true,
  extendable: true,
  attrs: {},
  json: null,
  ...over,
})

const questions = ["Which river is known as the Dakshin Ganga?", "Loktak lake is in which state?"]
const salts = ["0xaa", "0xbb"] as const
const commits = questions.map((q, i) => commitHash(salts[i], q))
const commit = row({ attrs: { set_code: "A" }, json: { v: 1, title: "t", commits } })
const reveal = row({ attrs: { set_code: "A", root: rootHash(commits) }, json: { v: 1, salts, questions } })

describe("openReveals", () => {
  it("accepts a reveal that matches the seal", () => {
    const paper = openReveals([commit], [reveal])
    expect(paper.map((q) => q.sealed)).toEqual([true, true])
  })

  it("flags a question swapped after sealing", () => {
    const swapped = row({ attrs: { set_code: "A" }, json: { v: 1, salts, questions: [questions[0], "A different question"] } })
    expect(openReveals([commit], [swapped]).map((q) => q.sealed)).toEqual([true, false])
  })
})

describe("deadline", () => {
  it("is the announced start when the paper comes out on time", () => {
    expect(deadlineOf(1000, 1005)).toBe(1000)
  })

  it("moves earlier if the paper was published before the announced start", () => {
    // an issuer announcing a late start can't make witnesses after the real release look early
    expect(deadlineOf(5000, 3000)).toBe(3000)
  })
})

describe("judge", () => {
  const paper = openReveals([commit], [reveal])
  const witness = row({ json: { v: 1, hashes: [questionHash("q2) LOKTAK lake is in which state"), questionHash("made up question")] } })

  it("counts real questions held before the deadline as a leak", () => {
    const v = judge(witness, 900, 1000, paper)
    expect(v.before).toBe(true)
    expect(v.matches.map((m) => m.index)).toEqual([2])
  })

  it("marks the same claim as late after the deadline", () => {
    expect(judge(witness, 1000, 1000, paper).before).toBe(false)
  })

  it("never matches questions whose reveal failed the seal check", () => {
    const bad = paper.map((q) => ({ ...q, sealed: false }))
    expect(judge(witness, 900, 1000, bad).matches).toEqual([])
  })

  it("works against a pasted official paper for open exams", () => {
    const pasted = pastedPaper("1. Loktak lake is in which state?\n2. Something else")
    expect(judge(witness, 900, 1000, pasted).matches.map((m) => m.index)).toEqual([1])
  })
})

describe("openExamFrom", () => {
  it("keeps the first registration of an ID and lists later ones as conflicts", () => {
    const first = row({ key: "0x1", createdAt: 10n, attrs: { exam_id: "open-x", opens_at_ms: 5000n }, json: { v: 1, title: "Real" } })
    const later = row({ key: "0x2", createdAt: 20n, attrs: { exam_id: "open-x", opens_at_ms: 9000n }, json: { v: 1, title: "Fake later start" } })
    const exam = openExamFrom([later, first])!
    expect(exam.title).toBe("Real")
    expect(exam.opensAtMs).toBe(5000)
    expect(exam.conflicts.map((c) => c.key)).toEqual(["0x2"])
  })
})
