import type { Address, Hex } from "viem"
import { commitHash, questionHash, splitQuestions } from "./hash"

export type CommitPayload = { v: 1; title: string; commits: Hex[] }
export type RevealPayload = { v: 1; salts: Hex[]; questions: string[] }
export type WitnessPayload = { v: 1; hashes: Hex[] }
export type OpenExamPayload = { v: 1; title: string; notice?: string }

export type PaperSet = { code: string; questions: string[] }
export type ExamSpec = { examId: string; title: string; shift: number; opensAtMs: number; sets: PaperSet[] }
export type SealSecrets = { examId: string; sets: { code: string; salts: Hex[]; questions: string[] }[] }

export type Row = {
  key: Hex
  creator: Address
  owner: Address
  createdAt: bigint
  expiresAt: bigint
  readonly: boolean
  extendable: boolean
  attrs: Record<string, string | number | bigint | boolean>
  json: unknown
}

export type Exam = {
  kind: "sealed" | "open"
  examId: string
  title: string
  shift?: number
  opensAtMs: number
  creator: Address
  notice?: string
  sets: Row[]
  forged: Row[]
  conflicts: Row[]
}

export const sameAddr = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export function groupExams(commits: Row[], issuer: Address): Exam[] {
  const byId = new Map<string, Exam>()
  for (const r of commits) {
    const id = String(r.attrs.exam_id)
    let exam = byId.get(id)
    if (!exam) {
      exam = {
        kind: "sealed",
        examId: id,
        title: (r.json as CommitPayload)?.title ?? id,
        shift: Number(r.attrs.shift),
        opensAtMs: Number(r.attrs.opens_at_ms),
        creator: issuer,
        sets: [],
        forged: [],
        conflicts: [],
      }
      byId.set(id, exam)
    }
    ;(sameAddr(r.creator, issuer) ? exam.sets : exam.forged).push(r)
  }
  const bySet = (a: Row, b: Row) => String(a.attrs.set_code).localeCompare(String(b.attrs.set_code))
  return [...byId.values()].filter((x) => x.sets.length > 0).map((x) => ({ ...x, sets: x.sets.sort(bySet) }))
}

// The first registration of an open exam ID wins; later ones with the same ID are shown as conflicts.
export function openExamFrom(entries: Row[]): Exam | null {
  if (entries.length === 0) return null
  const [first, ...rest] = [...entries].sort((a, b) => Number(a.createdAt - b.createdAt))
  const p = first.json as OpenExamPayload | null
  return {
    kind: "open",
    examId: String(first.attrs.exam_id),
    title: p?.title ?? String(first.attrs.exam_id),
    opensAtMs: Number(first.attrs.opens_at_ms),
    creator: first.creator,
    notice: p?.notice,
    sets: [first],
    forged: [],
    conflicts: rest,
  }
}

export type PaperQuestion = { set: string; index: number; text: string; hash: Hex; sealed: boolean }

export function openReveals(commits: Row[], reveals: Row[]): PaperQuestion[] {
  const out: PaperQuestion[] = []
  for (const r of reveals) {
    const p = r.json as RevealPayload
    const commit = commits.find((c) => c.attrs.set_code === r.attrs.set_code)
    const sealed = (commit?.json as CommitPayload | undefined)?.commits ?? []
    p.questions.forEach((text, i) => {
      out.push({
        set: String(r.attrs.set_code),
        index: i + 1,
        text,
        hash: questionHash(text),
        sealed: sealed[i] === commitHash(p.salts[i], text),
      })
    })
  }
  return out.sort((a, b) => a.set.localeCompare(b.set) || a.index - b.index)
}

export function pastedPaper(text: string): PaperQuestion[] {
  return splitQuestions(text).map((q, i) => ({ set: "", index: i + 1, text: q, hash: questionHash(q), sealed: true }))
}

export type Verdict = {
  witness: Row
  witnessedAtMs: number
  deadlineMs: number
  before: boolean
  matches: PaperQuestion[]
}

/**
 * The deadline is the earlier of the announced start and the moment the paper was actually made
 * public. An issuer who announces a later start can't make late witnesses look early.
 */
export function deadlineOf(opensAtMs: number, publishedAtMs?: number) {
  return publishedAtMs === undefined ? opensAtMs : Math.min(opensAtMs, publishedAtMs)
}

export function judge(witness: Row, witnessedAtMs: number, deadlineMs: number, paper: PaperQuestion[]): Verdict {
  const hashes = new Set((witness.json as WitnessPayload | null)?.hashes ?? [])
  return {
    witness,
    witnessedAtMs,
    deadlineMs,
    before: witnessedAtMs < deadlineMs,
    matches: paper.filter((q) => q.sealed && hashes.has(q.hash)),
  }
}


export function newOpenExamId(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  const tail = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("")
  return `open-${slug || "exam"}-${tail}`
}

// The public RPC refuses request bodies of 256 KB or more, and transaction data travels as hex (2 characters
// per byte), so one transaction can carry roughly 128 KB. Sets are packed in order into as few transactions as
// fit under a budget that leaves room for attributes and signatures. One transaction for a normal paper;
// a NEET-sized paper in many languages needs a few.
export const BATCH_BUDGET_BYTES = 100 * 1024

export function packBatches<T>(items: T[], size: (item: T) => number, budget = BATCH_BUDGET_BYTES, name: (item: T, i: number) => string = (_, i) => `#${i + 1}`): T[][] {
  const batches: T[][] = []
  let current: T[] = []
  let used = 0
  items.forEach((item, i) => {
    const n = size(item)
    if (n > budget) throw new Error(`Set ${name(item, i)} is ${Math.ceil(n / 1024)} KB, more than fits in one transaction (${budget / 1024} KB). Split it into two set codes.`)
    if (used + n > budget && current.length) {
      batches.push(current)
      current = []
      used = 0
    }
    current.push(item)
    used += n
  })
  if (current.length) batches.push(current)
  return batches
}
