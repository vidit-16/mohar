import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Address, Hex } from "viem"
import { watchBlockNumber } from "viem/actions"
import {
  blockTimeMs,
  deadlineOf,
  type Exam,
  groupExams,
  judge,
  examRecords,
  liveClient,
  openExamFrom,
  openReveals,
  type PaperQuestion,
  type Row,
  sameAddr,
  type Verdict,
} from "../lib/mohar"
import { errText, EXPLORER } from "../ui/format"
import { reader } from "./useChain"

export type FeedItem = { id: string; at: number; kind: "witness" | "extend"; who: string; href: string }
export type LiveState = "connecting" | "live" | "down"

export function useExam(examId: string, issuer: Address, pasted: PaperQuestion[]) {
  const [exam, setExam] = useState<Exam | null>()
  const [reveals, setReveals] = useState<Row[]>([])
  const [witnesses, setWitnesses] = useState<Row[]>([])
  const [cursor, setCursor] = useState<string>()
  const [error, setError] = useState<string>()
  const [times, setTimes] = useState<Map<bigint, number>>(new Map())
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [live, setLive] = useState<LiveState>("connecting")
  const [attempt, setAttempt] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const apply = useCallback(
    (r: Awaited<ReturnType<typeof examRecords>>) => {
      setExam(groupExams(r.commits, issuer)[0] ?? openExamFrom(r.entries))
      setReveals(r.reveals.filter((x) => sameAddr(x.creator, issuer)))
      setWitnesses(r.witnesses)
      setCursor(r.next)
      setError(undefined)
    },
    [issuer],
  )

  const load = useCallback(
    () =>
      examRecords(reader, examId)
        .then(apply)
        .catch((e) => setError(errText(e))),
    [examId, apply],
  )

  useEffect(() => {
    let current = true
    examRecords(reader, examId)
      .then((r) => current && apply(r))
      .catch((e) => current && setError(errText(e)))
    return () => {
      current = false
    }
  }, [examId, apply])

  const loadMore = useCallback(async () => {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const next = await examRecords(reader, examId, cursor)
      setWitnesses((ws) => [...ws, ...next.witnesses])
      setCursor(next.next)
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, examId])

  useEffect(() => {
    const blocks = [...(exam?.sets ?? []), ...(exam?.forged ?? []), ...(exam?.conflicts ?? []), ...reveals, ...witnesses].map((r) => r.createdAt)
    const missing = [...new Set(blocks)].filter((b) => !times.has(b))
    if (missing.length === 0) return
    let stop = false
    Promise.all(missing.map(async (b) => [b, await blockTimeMs(reader, b)] as const))
      .then((pairs) => !stop && setTimes((t) => new Map([...t, ...pairs])))
      .catch(() => undefined)
    return () => {
      stop = true
    }
  }, [exam, reveals, witnesses, times])

  const sealed = exam?.kind === "sealed"
  const paper = useMemo(() => (sealed ? (exam && reveals.length ? openReveals(exam.sets, reveals) : []) : pasted), [sealed, exam, reveals, pasted])
  const revealMs = sealed && reveals[0] ? times.get(reveals[0].createdAt) : undefined
  const deadlineMs = exam ? (sealed ? deadlineOf(exam.opensAtMs, revealMs) : exam.opensAtMs) : 0
  const hasPaper = paper.length > 0

  const verdicts = useMemo(() => {
    const out = new Map<Hex, Verdict>()
    if (!exam || (sealed && reveals.length > 0 && revealMs === undefined)) return out
    for (const w of witnesses) {
      const t = times.get(w.createdAt)
      if (t !== undefined) out.set(w.key, judge(w, t, deadlineMs, paper))
    }
    return out
  }, [exam, sealed, reveals.length, revealMs, witnesses, times, deadlineMs, paper])

  const known = useRef(new Set<string>())
  useEffect(() => {
    known.current = new Set([...(exam?.sets ?? []), ...reveals, ...witnesses].map((r) => r.key.toLowerCase()))
  }, [exam, reveals, witnesses])

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined
    let unwatch: (() => void) | undefined
    let last = 0
    const refetch = (ms: number) => {
      if (pending || document.visibilityState !== "visible") return
      const wait = Math.max(ms, last + 15_000 - Date.now())
      pending = setTimeout(() => {
        pending = undefined
        last = Date.now()
        load()
      }, wait)
    }
    let unwatchBlocks: (() => void) | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    // a rate-limited or dropped socket shouldn't leave the page offline for good: resubscribe with backoff
    const down = () => {
      setLive("down")
      if (retry || attempt >= 6) return
      retry = setTimeout(() => setAttempt((a) => a + 1), Math.min(60_000, 5000 * 2 ** attempt))
    }
    try {
      const client = liveClient()
      // "Connected" means blocks are actually arriving over the socket, not just that we asked
      unwatchBlocks = watchBlockNumber(client, { onBlockNumber: () => setLive("live"), onError: down })
      unwatch = client.watchEntityEvents({
        // events carry no attributes, so any create on the chain might be ours; refetch at most every 15s
        onEntityCreated: () => {
          setLive("live")
          refetch(4000)
        },
        onExpiryExtended: (ev) => {
          setLive("live")
          if (!known.current.has(ev.entityKey.toLowerCase())) return
          setFeed((f) => [{ id: `${ev.transactionHash}${ev.logIndex}`, at: Date.now(), kind: "extend" as const, who: "", href: `${EXPLORER}/tx/${ev.transactionHash}` }, ...f].slice(0, 12))
          refetch(2500)
        },
        onError: down,
      })
    } catch {
      Promise.resolve().then(down)
    }
    return () => {
      clearTimeout(pending)
      clearTimeout(retry)
      unwatch?.()
      unwatchBlocks?.()
    }
  }, [load, attempt])

  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (exam === undefined) return
    if (seen.current === null) {
      seen.current = new Set(witnesses.map((w) => w.key))
      return
    }
    const fresh = witnesses.filter((w) => !seen.current!.has(w.key))
    if (fresh.length === 0) return
    fresh.forEach((w) => seen.current!.add(w.key))
    setFeed((f) => [...fresh.map((w) => ({ id: w.key, at: Date.now(), kind: "witness" as const, who: w.creator, href: `${EXPLORER}/entity/${w.key}` })), ...f].slice(0, 12))
  }, [witnesses, exam])

  const status = error && exam === undefined ? "error" : exam === undefined ? "loading" : exam === null ? "missing" : "ready"
  return { status, error, exam, reveals, witnesses, paper, hasPaper, verdicts, times, revealMs, deadlineMs, cursor, loadMore, loadingMore, reload: load, live, feed } as const
}
