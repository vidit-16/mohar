import { ArrowRight, ChevronRight, Globe, Play, Plus, Search, Stamp, Users } from "lucide-react"
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react"
import type { Address } from "viem"
import { reader, useChain, useNow } from "../hooks/useChain"
import { useExam } from "../hooks/useExam"
import { useT } from "../i18n"
import { examHref, navigate } from "../router"
import { normalise, questionHash } from "../lib/hash"
import { DAY_MS, type Exam, examOutcome, examsFrom, groupExams, ISSUERS, openExamFrom, openExamsSince, type Outcome, witnessStats } from "../lib/mohar"
import { keep, kept } from "../lib/keep"
import { AddExamSheet } from "./AddExamSheet"
import { LacSeal, SealOutline } from "./brand"
import { LeakCard } from "./LeakCard"
import { loadingCard } from "./leakCardLoading"
import { errText, fmtClock, fmtDuration, fmtWhen, REPO, shownTitle } from "./format"
import { Empty, Skeleton, Tag } from "./primitives"
import { DEMO_EXAM, tourHref } from "./tourSteps"

type Tab = "sealed" | "open"

export function Home({ issuer, issuerName }: { issuer: Address; issuerName: string }) {
  const { t } = useT()
  const [sealed, setSealed] = useState<Exam[] | undefined>(() => kept(`sealed:${issuer}`))
  const [open, setOpen] = useState<Exam[] | undefined>(() => kept("open"))
  const [err, setErr] = useState<string>()
  const [q, setQ] = useState("")
  const [tab, setTab] = useState<Tab>("sealed")
  const [adding, setAdding] = useState(false)
  const now = useNow(30_000)
  const momentsRef = useDrawOnView<HTMLOListElement>()

  const load = () => {
    const since = Date.now() - 30 * DAY_MS
    Promise.all([examsFrom(reader, issuer, since), openExamsSince(reader, since)])
      .then(([commits, entries]) => {
        const s = groupExams(commits, issuer).sort((a, b) => b.opensAtMs - a.opensAtMs)
        const byId = new Map<string, typeof entries>()
        for (const e of entries) byId.set(String(e.attrs.exam_id), [...(byId.get(String(e.attrs.exam_id)) ?? []), e])
        const o = [...byId.values()].map((es) => openExamFrom(es)!).sort((a, b) => a.opensAtMs - b.opensAtMs)
        setSealed(s)
        setOpen(o)
        keep(`sealed:${issuer}`, s)
        keep("open", o)
      })
      .catch((e) => setErr(errText(e)))
  }
  useEffect(load, [issuer])
  const retry = () => {
    setErr(undefined)
    load()
  }

  const list = tab === "sealed" ? sealed : open
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (list ?? []).filter((x) => !needle || x.examId.toLowerCase().includes(needle) || x.title.toLowerCase().includes(needle))
  }, [list, q])
  const exactId = q.trim() && !shown.some((x) => x.examId === q.trim()) ? q.trim() : undefined

  // what happened at each sealed exam, loaded once the list scrolls into view; a busy or rate-limited network gets
  // a few retries, then the row falls back to when the exam was held
  const [outcomes, setOutcomes] = useState<Map<string, Outcome | "unknown">>(() => new Map(kept<[string, Outcome][]>("outcomes") ?? []))
  const listRef = useRef<HTMLDivElement>(null)
  // keyed by which exams are held, so the remembered list and the fresh one don't each trigger a round of reads
  const heldIds = (sealed ?? []).filter((x) => x.opensAtMs <= Date.now()).map((x) => x.examId).join(" ")
  useEffect(() => {
    const el = listRef.current
    const held = heldIds ? heldIds.split(" ").map((examId) => ({ examId })) : []
    if (!el || held.length === 0) return
    let live = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const get = (examId: string, tries = 0): void => {
      examOutcome(reader, examId, issuer)
        .then((o) => {
          if (!live) return
          setOutcomes((m) => {
            const next = new Map(m).set(examId, o)
            keep("outcomes", [...next].filter(([, v]) => v !== "unknown"))
            return next
          })
        })
        .catch(() => {
          if (!live) return
          if (tries < 3) timers.push(setTimeout(() => get(examId, tries + 1), 2000 * 2 ** tries))
          else setOutcomes((m) => new Map(m).set(examId, "unknown"))
        })
    }
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return
        io.disconnect()
        for (const x of held) get(x.examId)
      },
      { rootMargin: "300px" },
    )
    io.observe(el)
    return () => {
      live = false
      io.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [heldIds, issuer])

  return (
    <>
      <section className="hero">
        <SealOutline className="hero-outline" />
        <HeroLive />
        <h1>{t("hero.title")}</h1>
        <p className="lead">{t("hero.lead")}</p>
        <div className="hero-cta">
          <a className="btn btn-primary btn-lg" href={tourHref(0)} data-tour="tour-btn">
            <Play size={17} /> {t("hero.tour")}
          </a>
          <a className="btn btn-secondary btn-lg" href="#exams">
            {t("hero.browse")} <ArrowRight size={17} />
          </a>
        </div>
        <CaughtLeak />
      </section>

      <section id="how" className="section how">
        <h2 className="big">{t("how.big")}</h2>
        <ol className="moments" ref={momentsRef}>
          {([1, 2, 3] as const).map((i) => (
            <li key={i} className={i === 3 ? "is-bell" : ""} style={{ "--i": i - 1 } as CSSProperties}>
              <div className="m-time">{t(`how.m${i}.time`)}</div>
              <div className="m-when">{t(`how.m${i}.when`)}</div>
              <h3>{t(`how.m${i}.t`)}</h3>
              <p>{t(`how.m${i}.d`)}</p>
            </li>
          ))}
        </ol>
        <TryFingerprint />
      </section>

      <section className="section numbers" data-tour="proof">
        <p className="big-line">
          <span>{t("stat.a")}</span>
          {t("stat.b")}
        </p>
        <p className="numbers-src">
          {t("proof.src")} ·{" "}
          <a href={`${REPO}/blob/main/docs/leaks.md`} target="_blank" rel="noopener">
            {t("proof.cases")}
          </a>
        </p>
      </section>

      <section id="exams" className="section">
        <h2 className="big">{t("exams.title")}</h2>
        <div className="tabs-row">
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={tab === "sealed"} className={tab === "sealed" ? "on" : ""} onClick={() => setTab("sealed")}>
              {t("exams.sealed")}
            </button>
            <button role="tab" aria-selected={tab === "open"} className={tab === "open" ? "on" : ""} onClick={() => setTab("open")}>
              {t("exams.open")}
            </button>
          </div>
          <div className="tabs-tools">
            {tab === "open" && (
              <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
                <Plus size={15} /> {t("exams.add")}
              </button>
            )}
            <label className="search">
              <Search size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("exams.search")} aria-label={t("exams.search")} />
            </label>
          </div>
        </div>
        <p className="muted small tab-hint">
          {tab === "sealed" ? (
            <>
              {t("exams.sealedBy")} <b>{issuerName}</b>
            </>
          ) : (
            t("exams.openHint")
          )}
        </p>

        <div className="card list-card" ref={listRef}>
          {err && (
            <Empty icon={<Globe size={22} />} title={t("exams.offline")}>
              {err}{" "}
              <button className="link" onClick={retry}>
                {t("exams.retry")}
              </button>
            </Empty>
          )}
          {!list &&
            !err &&
            [0, 1].map((i) => (
              <div key={i} className="exam-row">
                <div className="grow stack-xs">
                  <Skeleton w="45%" h={16} />
                  <Skeleton w="30%" h={12} />
                </div>
              </div>
            ))}
          {list && shown.length === 0 && !exactId && <Empty icon={tab === "sealed" ? <Stamp size={22} /> : <Users size={22} />} title={t("exams.none")}>{tab === "open" && t("exams.noneOpen")}</Empty>}
          {exactId && (
            <a className="exam-row" href={examHref(exactId)}>
              <div className="grow">
                <div className="exam-title">
                  {t("exams.lookup")} “{exactId}”
                </div>
              </div>
              <ChevronRight size={18} className="muted" />
            </a>
          )}
          {shown.map((x) => {
            const upcoming = x.opensAtMs > now
            return (
              <a key={x.examId} className="exam-row" href={examHref(x.examId)}>
                <div className="grow">
                  <div className="exam-title">{shownTitle(x.title, !upcoming)}</div>
                  <div className="muted small">{fmtWhen(x.opensAtMs)}</div>
                </div>
                <ExamState upcoming={upcoming} open={tab === "open"} outcome={outcomes.get(x.examId)} opensAtMs={x.opensAtMs} now={now} />
                <ChevronRight size={18} className="muted hide-sm" />
              </a>
            )
          })}
        </div>
      </section>

      <section className="section trust" data-tour="trust">
        <h2 className="big">{t("trust.title")}</h2>
        <ul className="trust-list">
          <li>{t("trust.1")}</li>
          <li>{t("trust.2")}</li>
          <li>{t("trust.3")}</li>
          <li>{t("trust.4")}</li>
        </ul>
        <p className="muted small">{t("trust.arkiv")}</p>
      </section>

      <section id="issuers" className="section cta-card">
        <div>
          <h2>{t("bodies.title")}</h2>
          <p className="muted">{t("bodies.lead")}</p>
          <div className="row-gap">
            <a className="btn btn-primary" href="?issue=1">
              <Stamp size={16} /> {t("iss.nav")}
            </a>
            <a className="btn btn-secondary" href={examHref(DEMO_EXAM)}>
              {t("bodies.demo")} <ArrowRight size={16} />
            </a>
          </div>
        </div>
        <pre className="code">
          git clone {REPO}
          {"\n"}npm install && npm run wallets
          {"\n"}npm run demo
        </pre>
      </section>

      <AddExamSheet open={adding} onClose={() => setAdding(false)} onAdded={(id) => navigate(examHref(id))} />
    </>
  )
}

function ExamState({ upcoming, open, outcome, opensAtMs, now }: { upcoming: boolean; open: boolean; outcome?: Outcome | "unknown"; opensAtMs: number; now: number }) {
  const { t } = useT()
  if (upcoming) return <Tag tone="info">{t("exams.opensIn", { t: fmtDuration(opensAtMs - now) })}</Tag>
  if (open || outcome === "unknown") return <Tag>{t("exams.heldAgo", { t: fmtDuration(now - opensAtMs) })}</Tag>
  if (!outcome) return <Tag>…</Tag>
  if (outcome.kind === "leak")
    return (
      <span className="leak-out">
        <span aria-hidden="true">
          <LacSeal size={30} className="lac-mini" label="" />
        </span>
        <Tag tone="danger">{outcome.n === 1 ? t("exams.outcome.leak1") : t("exams.outcome.leaks", { n: outcome.n })}</Tag>
      </span>
    )
  if (outcome.kind === "clean") return <Tag tone="good">{t("exams.outcome.clean")}</Tag>
  return <Tag tone="warn">{t("exams.outcome.waiting")}</Tag>
}

// The one thing that leaves a witness's phone: type a question and watch its fingerprint change with every key.
// Nothing here touches the network.
function TryFingerprint() {
  const { t } = useT()
  const [text, setText] = useState(() => t("try.example"))
  const read = normalise(text)
  const fp = read ? questionHash(text) : undefined
  return (
    <div className="try" data-ui="">
      <h3>{t("try.title")}</h3>
      <label className="try-label" htmlFor="try-q">
        {t("try.label")}
      </label>
      <input id="try-q" className="input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoComplete="off" />
      <p className="muted small try-read">
        {t("try.reads")}: <span>{read || "—"}</span>
      </p>
      <div className="try-fp-k">{t("try.fp")}</div>
      <code className="try-fp">{fp ? [...fp].map((c, i) => <span key={`${i}${c}`}>{c}</span>) : <i>{t("try.empty")}</i>}</code>
      <p className="muted small">{t("try.note")}</p>
    </div>
  )
}

const DEMO_ISSUER = Object.keys(ISSUERS)[0] as Address

// The hero's picture is the product doing its job: the demo exam's caught leak, read live from the chain and drawn
// the way the exam page shows it.
function CaughtLeak() {
  const { t } = useT()
  const x = useExam(DEMO_EXAM, DEMO_ISSUER, [])
  const top = [...x.verdicts.values()].filter((v) => v.before && v.matches.length > 0).sort((a, b) => b.matches.length - a.matches.length)[0]
  const early = [...x.verdicts.values()].filter((v) => v.before && v.matches.length > 0).length
  const paper = x.paper.slice(0, 5)
  const sealMs = x.exam?.sets.length ? Math.min(...x.exam.sets.map((s) => x.times.get(s.createdAt) ?? Infinity)) : undefined
  const ready = !!(top && x.exam && paper.length && sealMs !== undefined && Number.isFinite(sealMs))
  if (!ready) return <LeakCard {...loadingCard(t, examHref(DEMO_EXAM))} />
  // seal, leak and bell can be seconds apart; give each its own room on the line, in order
  const sealPct = 6
  const bellPct = 84
  const leakPct = Math.min(bellPct - 14, Math.max(sealPct + 18, sealPct + ((top.witnessedAtMs - sealMs!) / (top.deadlineMs - sealMs!)) * (bellPct - sealPct)))
  return (
    <LeakCard
      href={examHref(DEMO_EXAM)}
      title={x.exam!.title}
      started={t("hero.app.started", { t: fmtWhen(x.exam!.opensAtMs) })}
      verdict={t("hero.app.caught")}
      sub={t("hero.app.sub", { n: top.matches.length, t: fmtDuration(top.deadlineMs - top.witnessedAtMs) })}
      caught
      questions={paper.map((q) => ({ code: `${q.set}-Q${q.index}`, text: q.text, hit: top.matches.some((m) => m.set === q.set && m.index === q.index) }))}
      hitLabel={t("hero.app.heldEarly")}
      stats={[
        { label: t("exam.stat.witnesses"), value: String(x.witnesses.length) },
        { label: t("hero.app.early"), value: String(early), tone: "red" },
        { label: t("exam.stat.integrity"), value: `${x.paper.filter((q) => q.sealed).length}/${x.paper.length}`, tone: "ok" },
        { label: t("exam.stat.forged"), value: String(x.exam!.forged.length) },
      ]}
      line={{
        sealPct,
        leakPct,
        bellPct,
        labels: [t("hero.app.sealed", { t: fmtClock(sealMs!) }), t("hero.app.leak", { t: fmtClock(top.witnessedAtMs) }), t("hero.app.bell", { t: fmtClock(top.deadlineMs) })],
      }}
      sealLabel={t("hero.app.sealLabel")}
    />
  )
}

// One line that shows the record is alive: the chain's block ticking, and how many witnesses have really been sealed.
// Every number comes from the chain; between polls the block advances at the chain's own block time.
function HeroLive() {
  const { t } = useT()
  const { clock, online } = useChain()
  const now = useNow(1000)
  const [count, setCount] = useState<string>()
  useEffect(() => {
    let live = true
    witnessStats(reader)
      .then((s) => live && setCount(`${s.count}${s.capped ? "+" : ""}`))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  const block = clock ? clock.block + BigInt(Math.max(0, Math.floor((now - clock.at) / (clock.secs * 1000)))) : undefined
  return (
    <p className="hero-live" aria-label={t("pulse.label")}>
      <i className={online === false ? "down" : ""} aria-hidden="true" />
      {t("pulse.live")}
      {block !== undefined && (
        <>
          {" · "}
          {t("pulse.block")} <b>#{block.toString()}</b>
        </>
      )}
      {count && (
        <span className="hero-live-count">
          <span className="sep">{" · "}</span>
          <b>{count}</b> {t("pulse.witnessed")}
        </span>
      )}
    </p>
  )
}

// Arms an element to play its drawing once it is half on screen. Without script, or with reduced motion, it simply
// shows its finished state.
function useDrawOnView<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return
    el.classList.add("armed")
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        el.classList.add("draw")
        io.disconnect()
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}
