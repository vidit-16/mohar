import { describe, expect, it } from "vitest"
import { commitHash, questionHash } from "../src/lib/hash"
import { BATCH_BUDGET_BYTES, groupExams, judge, newOpenExamId, openExamFrom, openReveals, packBatches, pastedPaper, type Row, sameAddr } from "../src/lib/rules"
import { describe as describeVerdict } from "../src/ui/verdict"
import { errText, fmtDuration, fmtRelative, short } from "../src/ui/format"

const ISSUER = "0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6"
const row = (over: Partial<Row>): Row => ({
  key: "0xk",
  creator: ISSUER,
  owner: ISSUER,
  createdAt: 1n,
  expiresAt: 100n,
  readonly: true,
  extendable: true,
  attrs: {},
  json: null,
  ...over,
})

describe("sameAddr", () => {
  it("ignores checksum case", () => expect(sameAddr(ISSUER, ISSUER.toLowerCase())).toBe(true))
  it("is false for different or missing addresses", () => {
    expect(sameAddr(ISSUER, "0x0000000000000000000000000000000000000001")).toBe(false)
    expect(sameAddr(undefined, ISSUER)).toBe(false)
    expect(sameAddr(ISSUER, "")).toBe(false)
  })
})

describe("groupExams", () => {
  const commit = (over: Partial<Row>) => row({ attrs: { exam_id: "E1", shift: 2, set_code: "A", opens_at_ms: 5000n }, json: { v: 1, title: "Real", commits: [] }, ...over })

  it("splits trusted sets from look-alikes by creator", () => {
    const forged = commit({ key: "0xf", creator: "0x0000000000000000000000000000000000000bad" })
    const [exam] = groupExams([commit({ key: "0xa" }), forged], ISSUER)
    expect(exam.sets.map((s) => s.key)).toEqual(["0xa"])
    expect(exam.forged.map((s) => s.key)).toEqual(["0xf"])
    expect(exam).toMatchObject({ kind: "sealed", examId: "E1", title: "Real", shift: 2, opensAtMs: 5000, creator: ISSUER })
    expect(exam.conflicts).toEqual([])
  })

  it("drops exams that only have forged seals", () => {
    expect(groupExams([commit({ creator: "0x0000000000000000000000000000000000000bad" })], ISSUER)).toEqual([])
  })

  it("orders sets by code", () => {
    const b = commit({ key: "0xb", attrs: { exam_id: "E1", set_code: "B", opens_at_ms: 1n } })
    const a = commit({ key: "0xa", attrs: { exam_id: "E1", set_code: "A", opens_at_ms: 1n } })
    expect(groupExams([b, a], ISSUER)[0].sets.map((s) => s.attrs.set_code)).toEqual(["A", "B"])
  })

  it("keeps separate exams apart and falls back to the id as title", () => {
    const out = groupExams([commit({ attrs: { exam_id: "E1", opens_at_ms: 1n } }), commit({ json: null, attrs: { exam_id: "E2", opens_at_ms: 2n } })], ISSUER)
    expect(out.map((x) => x.examId).sort()).toEqual(["E1", "E2"])
    expect(out.find((x) => x.examId === "E2")?.title).toBe("E2")
  })
})

describe("openExamFrom", () => {
  it("returns null when nothing is registered", () => expect(openExamFrom([])).toBeNull())
  it("reads title, start and notice from the first entry", () => {
    const e = openExamFrom([row({ creator: "0x1", attrs: { exam_id: "open-x", opens_at_ms: 9n }, json: { v: 1, title: "SSC", notice: "https://ssc.gov.in" } })])!
    expect(e).toMatchObject({ kind: "open", examId: "open-x", title: "SSC", opensAtMs: 9, notice: "https://ssc.gov.in", creator: "0x1", conflicts: [] })
  })
  it("falls back to the id when the payload is unreadable", () => expect(openExamFrom([row({ attrs: { exam_id: "open-y", opens_at_ms: 1n } })])!.title).toBe("open-y"))
})

describe("openReveals edge cases", () => {
  it("marks every question unsealed when the commit is missing", () => {
    const reveal = row({ attrs: { set_code: "C" }, json: { v: 1, salts: ["0x1"], questions: ["q"] } })
    expect(openReveals([], [reveal])).toEqual([{ set: "C", index: 1, text: "q", hash: questionHash("q"), sealed: false }])
  })
  it("matches each question against its own position only", () => {
    const qs = ["first", "second"], salts = ["0xa", "0xb"] as const
    const commit = row({ attrs: { set_code: "A" }, json: { v: 1, title: "t", commits: [commitHash(salts[1], qs[1]), commitHash(salts[0], qs[0])] } })
    const reveal = row({ attrs: { set_code: "A" }, json: { v: 1, salts, questions: qs } })
    expect(openReveals([commit], [reveal]).map((q) => q.sealed)).toEqual([false, false])
  })
})

describe("judge edge cases", () => {
  it("handles a witness with no readable payload", () => {
    const v = judge(row({ json: null }), 1, 2, pastedPaper("a"))
    expect(v).toMatchObject({ before: true, matches: [], witnessedAtMs: 1, deadlineMs: 2 })
  })
  it("pastedPaper numbers questions from 1 and trusts them", () => {
    expect(pastedPaper("x\n\ny").map((q) => [q.index, q.set, q.sealed])).toEqual([[1, "", true], [2, "", true]])
  })
})

describe("newOpenExamId", () => {
  it("slugs the title and adds 6 hex characters", () => {
    expect(newOpenExamId("SSC CGL 2026: Tier 1!")).toMatch(/^open-ssc-cgl-2026-tier-1-[0-9a-f]{6}$/)
  })
  it("never returns an empty slug and stays short", () => {
    expect(newOpenExamId("!!!")).toMatch(/^open-exam-[0-9a-f]{6}$/)
    expect(newOpenExamId("x".repeat(200)).length).toBeLessThanOrEqual(5 + 40 + 7)
  })
  it("is unique per call", () => expect(newOpenExamId("a")).not.toBe(newOpenExamId("a")))
  it("pads every random byte to two hex digits", () => {
    const real = crypto.getRandomValues.bind(crypto)
    crypto.getRandomValues = (<T extends ArrayBufferView | null>(a: T) => (a && new Uint8Array(a.buffer).set([0, 1, 10]), a)) as typeof crypto.getRandomValues
    try {
      expect(newOpenExamId("a")).toBe("open-a-00010a")
    } finally {
      crypto.getRandomValues = real
    }
  })
})

describe("verdict wording", () => {
  const t = (k: string, v?: Record<string, unknown>) => `${k}${v ? JSON.stringify(v) : ""}`
  const base = { witness: row({}), witnessedAtMs: 1, deadlineMs: 2, before: true, matches: [] }
  it("covers each state", () => {
    expect(describeVerdict(t as never, undefined, true, 1).kind).toBe("checking")
    expect(describeVerdict(t as never, { ...base, before: false }, true, 1)).toMatchObject({ kind: "late", tone: "warn" })
    expect(describeVerdict(t as never, base, false, 1)).toMatchObject({ kind: "wait", tone: "info" })
    expect(describeVerdict(t as never, base, true, 3)).toMatchObject({ kind: "fake", tone: "good", short: "v.fake.s · 0/3" })
    const leak = describeVerdict(t as never, { ...base, matches: [{ set: "A", index: 1, text: "", hash: "0x", sealed: true }] }, true, 4)
    expect(leak).toMatchObject({ kind: "leak", tone: "danger", title: 'v.leak.t{"n":1}', short: "v.leak.s · 1/4" })
  })
})

describe("format", () => {
  it("formats durations", () => {
    expect(fmtDuration(0)).toBe("1s")
    expect(fmtDuration(45_000)).toBe("45s")
    expect(fmtDuration(-90_000)).toBe("1m")
    expect(fmtDuration(2 * 3_600_000)).toBe("2h")
    expect(fmtDuration(2 * 3_600_000 + 5 * 60_000)).toBe("2h 5m")
    expect(fmtDuration(3 * 86_400_000)).toBe("3d")
    expect(fmtDuration(3 * 86_400_000 + 4 * 3_600_000)).toBe("3d 4h")
  })
  it("says in/ago", () => {
    expect(fmtRelative(10_000 + 120_000, 10_000)).toBe("in 2m")
    expect(fmtRelative(10_000, 10_000 + 120_000)).toBe("2m ago")
  })
  it("shortens addresses", () => expect(short("0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6")).toBe("0x6A47…36A6"))
  it("turns chain errors into plain words", () => {
    expect(errText(new Error("insufficient funds for gas * price + value"))).toMatch(/no test GLM/)
    expect(errText(new Error('429 {"error":"ANON_COST_LIMITED"}'))).toMatch(/read limit/)
    expect(errText("boom\nstack")).toBe("boom")
  })
})

describe("packBatches", () => {
  const kb = (n: number) => n * 1024
  it("keeps a normal paper in one transaction", () => {
    expect(packBatches([kb(39), kb(39)], (n) => n)).toEqual([[kb(39), kb(39)]])
  })
  it("splits in order once the budget would be passed, never reordering", () => {
    const sets = [40, 40, 40, 40, 40].map(kb)
    const out = packBatches(sets.map((n, i) => ({ n, i })), (s) => s.n)
    expect(out.map((b) => b.map((s) => s.i))).toEqual([[0, 1], [2, 3], [4]])
    for (const b of out) expect(b.reduce((a, s) => a + s.n, 0)).toBeLessThanOrEqual(BATCH_BUDGET_BYTES)
  })
  it("allows a batch exactly at the budget", () => {
    expect(packBatches([kb(50), kb(50), 1], (n) => n)).toEqual([[kb(50), kb(50)], [1]])
  })
  it("refuses a single set that can never fit, naming it", () => {
    expect(() => packBatches([kb(10), kb(101)], (n) => n, undefined, (_, i) => (i ? "A-hi" : "A-en"))).toThrow(/A-hi is 101 KB/)
  })
  it("handles nothing", () => expect(packBatches([], () => 1)).toEqual([]))
})
