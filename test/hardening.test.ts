import { describe, expect, it } from "vitest"
import { commitHash, questionHash, randomSalt, rootHash, splitQuestions } from "../src/lib/hash"
import { deadlineOf, judge, openExamFrom, openReveals, type Row } from "../src/lib/rules"
import { describe as describeVerdict } from "../src/ui/verdict"

const row = (over: Partial<Row>): Row => ({
  key: "0xk",
  creator: "0x1",
  owner: "0x1",
  createdAt: 1n,
  expiresAt: 9n,
  readonly: true,
  extendable: true,
  attrs: {},
  json: null,
  ...over,
})
const sealedSet = (code: string, qs: string[], salts: `0x${string}`[]) => ({
  commit: row({ key: `0xc${code}`, attrs: { set_code: code }, json: { v: 1, title: "t", commits: qs.map((q, i) => commitHash(salts[i], q)) } }),
  reveal: row({ key: `0xr${code}`, attrs: { set_code: code }, json: { v: 1, salts, questions: qs } }),
})

describe("hash helpers", () => {
  it("rootHash depends on every commit and their order", () => {
    expect(rootHash(["0xaa", "0xbb"])).toMatch(/^0x[0-9a-f]{64}$/)
    expect(rootHash(["0xaa", "0xbb"])).toBe(rootHash(["0xaa", "0xbb"]))
    expect(rootHash(["0xaa", "0xbb"])).not.toBe(rootHash(["0xbb", "0xaa"]))
    expect(rootHash(["0xaa", "0xbb"])).not.toBe(rootHash(["0xaabb"].map(() => "0xaa0xbb")).replace("x", "y"))
  })
  it("randomSalt is 32 random bytes", () => {
    const a = randomSalt()
    expect(a).toMatch(/^0x[0-9a-f]{64}$/)
    expect(a).not.toBe(randomSalt())
  })
  it("splitQuestions returns trimmed lines", () => {
    expect(splitQuestions("   Q1. padded   \n\tQ2. tabbed\t")).toEqual(["Q1. padded", "Q2. tabbed"])
  })
})

describe("openReveals with several sets", () => {
  const a = sealedSet("A", ["alpha one", "alpha two"], ["0x01", "0x02"])
  const b = sealedSet("B", ["beta one", "beta two"], ["0x03", "0x04"])

  it("checks each reveal against the commit of the same set", () => {
    const paper = openReveals([b.commit, a.commit], [a.reveal, b.reveal])
    expect(paper.every((q) => q.sealed)).toBe(true)
  })

  it("does not accept set B's reveal against set A's commit", () => {
    const swapped = row({ attrs: { set_code: "B" }, json: a.reveal.json })
    expect(openReveals([a.commit, b.commit], [swapped]).map((q) => q.sealed)).toEqual([false, false])
  })

  it("returns the paper ordered by set, then question number", () => {
    const paper = openReveals([a.commit, b.commit], [b.reveal, a.reveal])
    expect(paper.map((q) => `${q.set}${q.index}`)).toEqual(["A1", "A2", "B1", "B2"])
  })
})

describe("deadlineOf", () => {
  it("is the announced start when nothing has been published yet", () => expect(deadlineOf(1234)).toBe(1234))
  it("never moves later than the announced start", () => expect(deadlineOf(1000, 5000)).toBe(1000))
})

describe("judge", () => {
  it("only matches hashes the witness actually holds", () => {
    const paper = [{ set: "", index: 1, text: "x", hash: questionHash("x"), sealed: true }]
    expect(judge(row({ json: { v: 1, hashes: [] } }), 1, 2, paper).matches).toEqual([])
    expect(judge(row({ json: { v: 1, hashes: [questionHash("x")] } }), 1, 2, paper).matches).toHaveLength(1)
  })
})

describe("openExamFrom", () => {
  it("uses the first entry as the exam's only record", () => {
    const e = openExamFrom([row({ key: "0x1", attrs: { exam_id: "o", opens_at_ms: 1n } })])!
    expect(e.sets.map((s) => s.key)).toEqual(["0x1"])
    expect(e.forged).toEqual([])
    expect(e.conflicts).toEqual([])
  })
})

describe("verdict wording keys", () => {
  const t = (k: string) => k
  const v = { witness: row({}), witnessedAtMs: 1, deadlineMs: 2, before: true, matches: [] }
  const hit = { set: "A", index: 1, text: "", hash: "0x" as const, sealed: true }
  it.each([
    ["checking", undefined, true, { tone: "neutral", title: "v.checking", short: "…", explain: "" }],
    ["late", { ...v, before: false }, true, { tone: "warn", title: "v.late.t", short: "v.late.s", explain: "v.late.d" }],
    ["wait", v, false, { tone: "info", title: "v.wait.t", short: "v.wait.s", explain: "v.wait.d" }],
    ["leak", { ...v, matches: [hit] }, true, { tone: "danger", title: "v.leak.t", short: "v.leak.s · 1/2", explain: "v.leak.d" }],
    ["fake", v, true, { tone: "good", title: "v.fake.t", short: "v.fake.s · 0/2", explain: "v.fake.d" }],
  ] as const)("%s", (kind, verdict, hasPaper, expected) => {
    expect(describeVerdict(t as never, verdict as never, hasPaper, 2)).toEqual({ kind, ...expected })
  })
})
