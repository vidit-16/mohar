// Pure helpers for the keep-alive and evidence scripts, kept apart so they can be tested without a chain.

export const daysLeft = (expiresAt: bigint, head: bigint, blockSeconds: number) => (Number(expiresAt - head) * blockSeconds) / 86_400

export type Upkeep = { key: string; expiresAt: bigint; label: string; extendable: boolean }
export type TopUp = Upkeep & { left: number; add: number }

// Anything with fewer than minDays left gets topped up to roughly targetDays. Already-expired rows
// can't be extended (the node rejects it), and rows without permissionlessExtension can't be by us.
export function dueForTopUp(rows: Upkeep[], head: bigint, blockSeconds: number, minDays = 21, targetDays = 35): { extend: TopUp[]; skipped: TopUp[] } {
  const extend: TopUp[] = []
  const skipped: TopUp[] = []
  for (const r of rows) {
    const left = daysLeft(r.expiresAt, head, blockSeconds)
    if (left >= minDays) continue
    const row = { ...r, left, add: Math.ceil(targetDays - left) }
    if (left <= 0 || !r.extendable) skipped.push(row)
    else extend.push(row)
  }
  extend.sort((a, b) => a.left - b.left)
  return { extend, skipped }
}

export type ExamCount = { exam_id: string; paper_commit: number; reveal: number; open_exam: number; witness: number }

export function examCounts(records: { exam_id?: unknown; type?: unknown }[]): ExamCount[] {
  const by = new Map<string, ExamCount>()
  for (const r of records) {
    const id = String(r.exam_id ?? "")
    if (!id) continue
    const c = by.get(id) ?? { exam_id: id, paper_commit: 0, reveal: 0, open_exam: 0, witness: 0 }
    if (r.type === "paper_commit" || r.type === "reveal" || r.type === "open_exam" || r.type === "witness") c[r.type]++
    by.set(id, c)
  }
  return [...by.values()].sort((a, b) => a.exam_id.localeCompare(b.exam_id))
}
