import { execFileSync } from "node:child_process"
import { beforeAll, describe, expect, it } from "vitest"
import { BURN, blockTimeMs, deadlineOf, examRecords, groupExams, judge, openExamFrom, openReveals, publicClient, RPC_URL, type Row, sameAddr } from "../../src/lib/mohar"

const ISSUER = "0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6"
const HELD = "DSPSC-PRE26-10170937"
const UPCOMING = "DSPSC-PRE26-U10170941"
const OPEN = "open-demo-mock-test-open-exam-e96c10"
// the demo records have to stay readable until at least 23 Oct
const MUST_LIVE_UNTIL = Date.parse("2026-10-24T00:00:00+05:30")

const client = publicClient()
let head: bigint
let blockSecs: number
const expiryMs = (r: Row) => Date.now() + Number(r.expiresAt - head) * blockSecs * 1000

beforeAll(async () => {
  const t = await client.getBlockTiming()
  head = t.currentBlock
  blockSecs = t.blockDuration
})

describe("held demo exam", () => {
  let data: Awaited<ReturnType<typeof examRecords>>
  beforeAll(async () => {
    data = await examRecords(client, HELD)
  })

  it("has two sets sealed by the issuer, burned and read-only, plus one forged look-alike", () => {
    const [exam] = groupExams(data.commits, ISSUER)
    expect(exam.sets).toHaveLength(2)
    expect(exam.forged).toHaveLength(1)
    for (const s of exam.sets) {
      expect(sameAddr(s.creator, ISSUER)).toBe(true)
      expect(sameAddr(s.owner, BURN)).toBe(true)
      expect(s.readonly && s.extendable).toBe(true)
    }
  })

  it("reveals every question and every one matches its seal", () => {
    const [exam] = groupExams(data.commits, ISSUER)
    const reveals = data.reveals.filter((r) => sameAddr(r.creator, ISSUER))
    expect(reveals).toHaveLength(2)
    expect(new Set(reveals.map((r) => r.createdAt)).size).toBe(1)
    const paper = openReveals(exam.sets, reveals)
    expect(paper).toHaveLength(10)
    expect(paper.every((q) => q.sealed)).toBe(true)
  })

  it("finds the leak before the deadline and the late claim after it", async () => {
    const [exam] = groupExams(data.commits, ISSUER)
    const reveals = data.reveals.filter((r) => sameAddr(r.creator, ISSUER))
    const deadline = deadlineOf(exam.opensAtMs, await blockTimeMs(client, reveals[0].createdAt))
    const paper = openReveals(exam.sets, reveals)
    const verdicts = await Promise.all(data.witnesses.map(async (w) => judge(w, await blockTimeMs(client, w.createdAt), deadline, paper)))
    const leak = verdicts.find((v) => v.before)!
    const late = verdicts.find((v) => !v.before)!
    expect(leak.matches.map((m) => `${m.set}-Q${m.index}`)).toEqual(["A-Q2", "A-Q4", "A-Q5"])
    expect(late.matches.map((m) => `${m.set}-Q${m.index}`)).toEqual(["B-Q3"])
  })

  it("keeps every record alive past 23 Oct", () => {
    for (const r of [...data.commits, ...data.reveals, ...data.witnesses]) expect(expiryMs(r), r.key).toBeGreaterThan(MUST_LIVE_UNTIL)
  })
})

describe("upcoming demo exam", () => {
  it("is sealed, not revealed, and alive past 23 Oct", async () => {
    const data = await examRecords(client, UPCOMING)
    const [exam] = groupExams(data.commits, ISSUER)
    expect(exam.sets).toHaveLength(2)
    expect(exam.opensAtMs).toBeGreaterThan(Date.now())
    expect(data.reveals).toHaveLength(0)
    for (const r of [...data.commits, ...data.witnesses]) expect(expiryMs(r), r.key).toBeGreaterThan(MUST_LIVE_UNTIL)
  })
})

describe("open demo exam", () => {
  it("has its entry, a witness from before the start, and both outlive 23 Oct", async () => {
    const data = await examRecords(client, OPEN)
    const exam = openExamFrom(data.entries)!
    expect(exam.kind).toBe("open")
    expect(data.witnesses.length).toBeGreaterThanOrEqual(1)
    const w = data.witnesses[0]
    expect(await blockTimeMs(client, w.createdAt)).toBeLessThan(exam.opensAtMs)
    for (const r of [...data.entries, ...data.witnesses]) expect(expiryMs(r), r.key).toBeGreaterThan(MUST_LIVE_UNTIL)
  })
})

describe("verify.mjs parity on live data", () => {
  it("prints the same verdicts as the app", () => {
    const out = execFileSync(process.execPath, ["verify.mjs", HELD], { env: { ...process.env, ...(RPC_URL ? { ARKIV_RPC: RPC_URL } : {}) }, encoding: "utf8" })
    expect(out).toContain("2 set(s) by 0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6, 1 look-alike(s)")
    expect(out).toContain("10/10 questions match the seal")
    expect(out).toMatch(/BEFORE: LEAK A-Q2, A-Q4, A-Q5/)
    expect(out).toMatch(/AFTER: too late/)
  })
})
