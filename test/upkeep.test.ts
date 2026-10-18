import { describe, expect, it } from "vitest"
import { daysLeft, dueForTopUp, examCounts, type Upkeep } from "../scripts/upkeep"

const DAY = 43_200n // blocks per day at 2 s
const row = (label: string, daysFromHead: number, extendable = true): Upkeep => ({ key: `0x${label}`, label, expiresAt: 1_000_000n + BigInt(Math.round(daysFromHead * 43_200)), extendable })

describe("daysLeft", () => {
  it("turns blocks into days", () => {
    expect(daysLeft(1_000_000n + DAY, 1_000_000n, 2)).toBe(1)
    expect(daysLeft(1_000_000n - DAY / 2n, 1_000_000n, 2)).toBe(-0.5)
  })
})

describe("dueForTopUp", () => {
  it("tops up only what's under the threshold, soonest first, to about the target", () => {
    const { extend, skipped } = dueForTopUp([row("ok", 30), row("soon", 13.3), row("sooner", 2), row("edge", 21)], 1_000_000n, 2, 21, 35)
    expect(skipped).toEqual([])
    expect(extend.map((r) => [r.label, r.add])).toEqual([["sooner", 33], ["soon", 22]])
    for (const r of extend) expect(r.left + r.add).toBeGreaterThanOrEqual(35)
  })
  it("skips rows it can't extend: not extendable, or already expired", () => {
    const { extend, skipped } = dueForTopUp([row("locked", 5, false), row("gone", -1), row("now", 0), row("fine", 3)], 1_000_000n, 2)
    expect(extend.map((r) => r.label)).toEqual(["fine"])
    expect(skipped.map((r) => r.label).sort()).toEqual(["gone", "locked", "now"])
  })
  it("does nothing when everything is healthy", () => {
    expect(dueForTopUp([row("a", 40), row("b", 22)], 1_000_000n, 2)).toEqual({ extend: [], skipped: [] })
  })
})

describe("examCounts", () => {
  it("counts each record type per exam and ignores junk", () => {
    const rows = [
      { exam_id: "B", type: "witness" },
      { exam_id: "A", type: "paper_commit" },
      { exam_id: "A", type: "paper_commit" },
      { exam_id: "A", type: "reveal" },
      { exam_id: "A", type: "something-else" },
      { type: "witness" },
      { exam_id: "C", type: "open_exam" },
    ]
    expect(examCounts(rows)).toEqual([
      { exam_id: "A", paper_commit: 2, reveal: 1, open_exam: 0, witness: 0 },
      { exam_id: "B", paper_commit: 0, reveal: 0, open_exam: 0, witness: 1 },
      { exam_id: "C", paper_commit: 0, reveal: 0, open_exam: 1, witness: 0 },
    ])
  })
})
