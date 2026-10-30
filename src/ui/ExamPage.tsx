import { ArrowLeft, BadgeCheck, Ban, Bell, ChevronRight, CircleCheck, CircleX, ExternalLink, FileText, Fingerprint, Globe, Info, Radio, ShieldAlert, Terminal, TriangleAlert, Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { Address, Hex } from "viem"
import { useChain, useNow } from "../hooks/useChain"
import { useExam } from "../hooks/useExam"
import type { IssuerSource } from "../hooks/useIssuer"
import { useT } from "../i18n"
import { BURN, pastedPaper, QUERIES, sameAddr, type WitnessPayload } from "../lib/mohar"
import { EvidenceDrawer, KeepAlive } from "./EvidenceDrawer"
import { fmtDateTime, fmtDuration, fmtRelative, fmtTime, RPC } from "./format"
import { Badge, CopyButton, Empty, Mono, Skeleton, Stat } from "./primitives"
import { Timeline } from "./Timeline"
import { describe } from "./verdict"
import { WitnessSheet } from "./WitnessSheet"

type Filter = "all" | "leak" | "before" | "late"
export type TourAction = { action: "evidence-leak" | "close" | "witness" | "tech-on" | "tech-off" | "forged-open"; prefill?: string }

export function ExamPage({ examId, issuer, issuerName, source, domain, homeHref }: { examId: string; issuer: Address; issuerName: string; source: IssuerSource; domain?: string; homeHref: string }) {
  const { t } = useT()
  const [pasteText, setPasteText] = useState("")
  const [pasteApplied, setPasteApplied] = useState("")
  const pasted = useMemo(() => pastedPaper(pasteApplied), [pasteApplied])
  const x = useExam(examId, issuer, pasted)
  // a paper too big for one transaction is revealed in a few back-to-back ones (see packBatches)
  const revealBlocks = [...new Set(x.reveals.map((r) => r.createdAt))].sort((a, b) => (a < b ? -1 : 1))
  const revealTxs = revealBlocks.length
  const firstRevealBlock = revealBlocks[0]
  const { msUntilBlock } = useChain()
  const now = useNow(1000)
  const [witnessOpen, setWitnessOpen] = useState(false)
  const [prefill, setPrefill] = useState<string>()
  const [picked, setPicked] = useState<Hex | undefined>(() => (new URLSearchParams(location.search).get("w") as Hex | null) ?? undefined)
  const [filter, setFilter] = useState<Filter>("all")
  const [tech, setTech] = useState(false)
  const [forgedOpen, setForgedOpen] = useState(false)

  const exam = x.exam
  const sealed = exam?.kind === "sealed"
  const opened = exam ? now >= exam.opensAtMs : false
  const startMs = exam?.sets.length ? Math.min(...exam.sets.map((s) => x.times.get(s.createdAt) ?? Infinity)) : undefined

  const rows = useMemo(() => {
    const list = [...x.witnesses].sort((a, b) => Number(a.createdAt - b.createdAt))
    return list.map((w) => {
      const v = x.verdicts.get(w.key)
      const n = (w.json as WitnessPayload | null)?.hashes?.length ?? 0
      return { w, v, d: describe(t, v, x.hasPaper, n), n }
    })
  }, [x.witnesses, x.verdicts, x.hasPaper, t])

  const leaks = rows.filter((r) => r.d.kind === "leak")
  const counts = { before: rows.filter((r) => r.v?.before).length, late: rows.filter((r) => r.d.kind === "late").length, leak: leaks.length }
  const filtered = rows.filter((r) => (filter === "all" ? true : filter === "leak" ? r.d.kind === "leak" : filter === "before" ? r.v?.before : r.d.kind === "late"))
  const firstLeak = leaks[0]
  const integrity = sealed && x.paper.length ? x.paper.filter((q) => q.sealed).length : 0
  const pickedRow = rows.find((r) => r.w.key === picked)

  // a NEET-sized paper is hundreds of questions: show the first ones plus anything that leaked or
  // doesn't match its seal, and let people expand the rest
  const [showAllPaper, setShowAllPaper] = useState(false)
  const allPaper = x.paper.map((q) => ({ q, hits: leaks.filter((r) => r.v!.matches.some((m) => m.set === q.set && m.index === q.index)).length }))
  const paperRows = showAllPaper || allPaper.length <= 60 ? allPaper : allPaper.filter(({ q, hits }, i) => i < 30 || hits > 0 || !q.sealed)

  useEffect(() => {
    const onTour = (e: Event) => {
      const d = (e as CustomEvent<TourAction>).detail
      if (d.action === "evidence-leak" && firstLeak) setPicked(firstLeak.w.key)
      if (d.action === "close") {
        setPicked(undefined)
        setWitnessOpen(false)
      }
      if (d.action === "witness") {
        setPrefill(d.prefill)
        setWitnessOpen(true)
      }
      if (d.action === "tech-on") setTech(true)
      if (d.action === "tech-off") setTech(false)
      if (d.action === "forged-open") setForgedOpen(true)
    }
    window.addEventListener("mohar:tour", onTour)
    return () => window.removeEventListener("mohar:tour", onTour)
  }, [firstLeak])

  if (x.status === "loading") return <ExamSkeleton homeHref={homeHref} />
  if (x.status === "error")
    return (
      <div className="card">
        <Empty icon={<TriangleAlert size={22} />} title={t("exams.offline")}>
          {x.error}{" "}
          <button className="link" onClick={x.reload}>
            {t("exams.retry")}
          </button>
        </Empty>
      </div>
    )
  if (x.status === "missing" || !exam)
    return (
      <>
        <BackLink href={homeHref} />
        <div className="card">
          <Empty icon={<ShieldAlert size={22} />} title={t("exam.missing")}>
            {t("exam.missingHint")} <code>{examId}</code>
          </Empty>
        </div>
      </>
    )

  const timeStr = fmtDateTime(exam.opensAtMs)
  const meaning = sealed
    ? !opened
      ? t("mean.upcoming", { time: timeStr })
      : !x.hasPaper
        ? t("mean.awaiting")
        : firstLeak?.v
          ? t("mean.leak", { n: firstLeak.v.matches.length, t: fmtDuration(firstLeak.v.deadlineMs - firstLeak.v.witnessedAtMs) })
          : t("mean.clean")
    : !opened
      ? t("mean.openUpcoming", { time: timeStr })
      : x.hasPaper
        ? t("mean.openChecked", { n: counts.leak })
        : t("mean.openAfter")

  const status = !sealed ? (
    <Badge tone="info" icon={<Users size={12} />}>
      {t("exam.status.open")}
    </Badge>
  ) : !opened ? (
    <Badge tone="info" icon={<Fingerprint size={12} />}>
      {t("exam.status.accepting")}
    </Badge>
  ) : x.hasPaper ? (
    <Badge tone="neutral" icon={<CircleCheck size={12} />}>
      {t("exam.status.revealed")}
    </Badge>
  ) : (
    <Badge tone="warn" icon={<Bell size={12} />}>
      {t("exam.status.awaiting")}
    </Badge>
  )

  return (
    <div className={tech ? "show-tech" : ""}>
      <BackLink href={homeHref} />

      <header className="exam-head" data-tour="exam-head">
        <div className="grow">
          <div className="exam-meta">
            {status}
            <span className="muted small">
              {exam.shift ? `Shift ${exam.shift} · ` : ""}
              <code>{exam.examId}</code> <CopyButton value={exam.examId} label="Copy exam ID" />
            </span>
          </div>
          <h1>{exam.title}</h1>
          <p className="muted">
            {opened ? t("exam.opened") : t("exam.opens")} <b className="ink">{timeStr}</b>
            {!opened && (
              <span className="countdown">
                {" "}
                · {fmtDuration(exam.opensAtMs - now)} {t("exam.toBell")}
              </span>
            )}
          </p>
        </div>
        <div className="head-actions">
          <label className="switch">
            <input type="checkbox" checked={tech} onChange={(e) => setTech(e.target.checked)} />
            <span className="switch-ui" aria-hidden />
            {t("exam.tech")}
          </label>
          <button className={`btn ${opened ? "btn-secondary" : "btn-primary"} btn-lg`} onClick={() => setWitnessOpen(true)} data-tour="witness-btn">
            <Fingerprint size={18} /> {t("exam.witness")}
          </button>
        </div>
      </header>

      <section className={`meaning ${firstLeak ? "meaning-leak" : ""}`} data-tour="meaning">
        {firstLeak ? <ShieldAlert size={20} /> : <Info size={20} />}
        <div className="grow">
          <div className="meaning-k">{firstLeak ? t("exam.leakAlert") : t("exam.meaning")}</div>
          <p>{meaning}</p>
        </div>
        {firstLeak && (
          <span className="meaning-stamp" aria-hidden="true">
            LEAK
          </span>
        )}
        {firstLeak && (
          <button className="btn btn-sm btn-danger" onClick={() => setPicked(firstLeak.w.key)}>
            {t("exam.viewEvidence")}
          </button>
        )}
      </section>

      <section className="stats" data-tour="stats">
        {sealed ? (
          <Stat label={t("exam.stat.seal")} value={<span className="ok-inline"><BadgeCheck size={18} /> {exam.sets.length}</span>} hint={issuerName} />
        ) : (
          <Stat label={t("exam.stat.entry")} value={<span className="stat-addr">{exam.creator.slice(0, 6)}…{exam.creator.slice(-4)}</span>} hint={t("exam.status.open")} />
        )}
        <Stat label={t("exam.stat.witnesses")} value={x.witnesses.length + (x.cursor ? "+" : "")} hint={`${counts.before} ${t("exam.stat.before")} · ${counts.late} ${t("exam.stat.after")}`} />
        {sealed ? (
          <Stat label={t("exam.stat.integrity")} value={x.hasPaper ? `${integrity}/${x.paper.length}` : "—"} hint={x.hasPaper ? (integrity === x.paper.length ? "✓" : "✗") : t("exam.status.awaiting")} />
        ) : (
          <Stat label={t("exam.filter.leak")} value={x.hasPaper ? counts.leak : "—"} hint={x.hasPaper ? "" : t("exam.check")} />
        )}
        {sealed ? <Stat label={t("exam.stat.forged")} value={exam.forged.length} /> : <Stat label={t("exam.filter.late")} value={counts.late} />}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{t("exam.timeline")}</h2>
          <span className="muted small">{t("exam.timelineHint")}</span>
        </div>
        <Timeline
          startMs={startMs !== undefined && Number.isFinite(startMs) ? startMs : undefined}
          startLabel={sealed ? t("how.1.t") : t("exam.stat.entry")}
          official={sealed}
          opensAtMs={exam.opensAtMs}
          deadlineMs={x.deadlineMs}
          revealMs={x.revealMs}
          now={now}
          onPick={setPicked}
          points={rows.flatMap((r) => (r.v ? [{ key: r.w.key, ms: r.v.witnessedAtMs, tone: r.d.tone, label: r.d.short }] : []))}
        />
      </section>

      {!sealed && opened && (
        <section className="card" data-tour="check">
          <div className="card-head">
            <h2>
              <FileText size={16} /> {t("exam.check")}
            </h2>
          </div>
          <p className="muted small">{t("exam.checkHint")}</p>
          <textarea rows={5} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"1. …\n2. …"} />
          <div className="row-gap" style={{ marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" disabled={!pasteText.trim()} onClick={() => setPasteApplied(pasteText)}>
              {t("exam.checkBtn")}
            </button>
            {pasteApplied && (
              <button className="btn btn-ghost btn-sm" onClick={() => (setPasteApplied(""), setPasteText(""))}>
                {t("exam.checkClear")}
              </button>
            )}
          </div>
        </section>
      )}

      <div className="split">
        <section className="card" data-tour="witnesses">
          <div className="card-head">
            <h2>{t("exam.witnesses")}</h2>
            <div className="chips" role="tablist">
              {(
                [
                  ["all", t("exam.filter.all"), rows.length],
                  ["leak", t("exam.filter.leak"), counts.leak],
                  ["before", t("exam.filter.before"), counts.before],
                  ["late", t("exam.filter.late"), counts.late],
                ] as const
              ).map(([k, label, n]) => (
                <button key={k} role="tab" aria-selected={filter === k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>
                  {label} {n}
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <Empty icon={<Fingerprint size={22} />} title={t("exam.noWitnesses")}>
              {!opened && t("exam.noWitnessesHint")}
            </Empty>
          ) : (
            <ul className="wlist">
              {filtered.map(({ w, v, d, n }) => (
                <li key={w.key}>
                  <button className={`wrow ${d.kind === "leak" ? "wrow-leak" : ""}`} onClick={() => setPicked(w.key)} data-tour={`w-${d.kind}`}>
                    <span className={`wdot tone-${d.tone}`}>
                      <Fingerprint size={14} />
                    </span>
                    <span className="grow">
                      <span className="wtitle">{d.title}</span>
                      <span className="muted small">
                        {n} × <Fingerprint size={11} /> · {v ? `${fmtTime(v.witnessedAtMs)} · ${fmtDuration(Math.abs(v.deadlineMs - v.witnessedAtMs))} ${v.before ? t("v.before") : t("v.after")}` : "…"}
                        <span className="tech-only"> · {w.creator.slice(0, 6)}…{w.creator.slice(-4)} · #{String(w.createdAt)}</span>
                      </span>
                    </span>
                    <Badge tone={d.tone}>{d.short}</Badge>
                    <ChevronRight size={16} className="muted hide-sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {x.cursor && (
            <button className="btn btn-secondary btn-block" onClick={x.loadMore} disabled={x.loadingMore}>
              {t("exam.loadMore")}
            </button>
          )}
        </section>

        <aside className="side">
          {sealed ? (
            <section className="card" data-tour="seal">
              <div className="card-head">
                <h2>{t("exam.seal")}</h2>
                <Badge tone="good" icon={<BadgeCheck size={12} />}>
                  {t("exam.verified")}
                </Badge>
              </div>
              <p className="muted small">{t("exam.sealNote")}</p>
              <p className={`small trust-line trust-${source}`}>
                {source === "domain" ? <Globe size={14} /> : source === "link" ? <TriangleAlert size={14} /> : <BadgeCheck size={14} />}{" "}
                {source === "domain" ? t("trust.domain").replace("{domain}", domain ?? "") : source === "link" ? t("trust.link") : t("trust.registry")}
              </p>
              <p className="small tech-only">
                <Mono value={issuer} kind="address" /> {issuerName}
              </p>
              <ul className="sets">
                {exam.sets.map((s) => (
                  <li key={s.key}>
                    <div className="set-top">
                      <b>Set {String(s.attrs.set_code)}</b>
                      <span className="muted small">{String(s.attrs.n_q)} Q</span>
                      <span className="grow" />
                      <Badge tone={sameAddr(s.owner, BURN) ? "good" : "warn"}>{t("exam.undeletable")}</Badge>
                    </div>
                    <div className="muted small">
                      {x.times.get(s.createdAt) ? fmtRelative(x.times.get(s.createdAt)!, now) : "…"}
                      <span className="tech-only">
                        {" "}
                        · #{String(s.createdAt)} · <Mono value={s.key} kind="entity" head={8} tail={4} />
                      </span>
                    </div>
                    <KeepAlive row={s} msLeft={msUntilBlock(s.expiresAt)} onDone={x.reload} compact />
                  </li>
                ))}
              </ul>
              {exam.forged.length > 0 && (
                <details className="forged" open={forgedOpen} onToggle={(e) => setForgedOpen((e.target as HTMLDetailsElement).open)} data-tour="forged">
                  <summary>
                    <Ban size={14} /> {t("exam.forgedTitle", { n: exam.forged.length })}
                  </summary>
                  <p className="muted small">{t("exam.forgedNote")}</p>
                  {exam.forged.map((f) => (
                    <div key={f.key} className="small forged-row">
                      <CircleX size={14} /> Set {String(f.attrs.set_code)} · <Mono value={f.creator} kind="address" />
                    </div>
                  ))}
                </details>
              )}
            </section>
          ) : (
            <section className="card" data-tour="seal">
              <div className="card-head">
                <h2>{t("exam.entry")}</h2>
              </div>
              <p className="muted small">{t("exam.entryNote")}</p>
              <dl className="kv kv-tight">
                <dt>{t("exam.stat.entry")}</dt>
                <dd>
                  <Mono value={exam.creator} kind="address" />
                </dd>
                <dt>{t("exam.opens")}</dt>
                <dd>{timeStr}</dd>
                {exam.notice && (
                  <>
                    <dt>{t("exam.notice")}</dt>
                    <dd>
                      <a href={exam.notice} target="_blank" rel="noreferrer nofollow">
                        {new URL(exam.notice).hostname} <ExternalLink size={12} />
                      </a>
                    </dd>
                  </>
                )}
              </dl>
              {exam.conflicts.length > 0 && (
                <details className="conflicts">
                  <summary className="small warn-text">
                    <TriangleAlert size={13} /> {t("exam.conflicts", { n: exam.conflicts.length })}
                  </summary>
                  <p className="muted small">{t("exam.conflictsWhy")}</p>
                  <ul>
                    {exam.conflicts.map((c) => {
                      const claimed = Number(c.attrs.opens_at_ms)
                      const at = x.times.get(c.createdAt)
                      return (
                        <li key={c.key} className="small">
                          <Mono value={c.creator} kind="address" /> · {t("exam.conflictAdded")} {at ? fmtDateTime(at) : "…"}
                          <br />
                          {t("exam.conflictClaims")} <b>{fmtDateTime(claimed)}</b>
                          {claimed !== exam.opensAtMs && <Badge tone="warn">{fmtDuration(Math.abs(claimed - exam.opensAtMs))} {claimed > exam.opensAtMs ? t("exam.conflictLater") : t("exam.conflictEarlier")}</Badge>}
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )}
              <KeepAlive row={exam.sets[0]} msLeft={msUntilBlock(exam.sets[0].expiresAt)} onDone={x.reload} compact />
            </section>
          )}

          <section className="card" data-tour="live">
            <div className="card-head">
              <h2>
                <Radio size={16} /> {t("exam.live")}
              </h2>
              <span className={`live live-${x.live}`}>
                <i /> {x.live === "down" ? t("exam.liveOff") : t("exam.liveOn")}
              </span>
            </div>
            {x.feed.length === 0 ? (
              <p className="muted small">{t("exam.liveHint")}</p>
            ) : (
              <ul className="feed">
                {x.feed.map((f) => (
                  <li key={f.id} className="feed-in">
                    <span className={`feed-dot ${f.kind}`} />
                    <span className="grow">{f.kind === "witness" ? `${t("exam.witness")} · ${f.who.slice(0, 6)}…` : t("ev.kept")}</span>
                    <a href={f.href} target="_blank" rel="noreferrer" className="muted small">
                      {fmtTime(f.at)} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {sealed && x.hasPaper && (
        <section className="card" data-tour="paper">
          <div className="card-head">
            <h2>
              <FileText size={16} /> {t("exam.paper")}
            </h2>
            <span className="muted small">
              {revealTxs > 1 ? t("exam.paperNoteSplit", { n: revealTxs }) : t("exam.paperNote")}
              {x.revealMs ? ` · ${fmtTime(x.revealMs)}` : ""}
              <span className="tech-only"> · #{String(firstRevealBlock)}</span>
            </span>
          </div>
          <div className="paper">
            {paperRows.map(({ q, hits }, i) => {
              return (
                <div key={`${q.set}${q.index}`} className={`pq ${hits ? "hit" : ""}`} style={{ animationDelay: `${Math.min(i, 20) * 0.04}s` }}>
                  <span className="pq-n">
                    {q.set}-Q{q.index}
                  </span>
                  <span className="grow">{q.text}</span>
                  {hits > 0 && (
                    <Badge tone="danger">
                      {t("exam.heldEarly")} {hits}
                    </Badge>
                  )}
                  {q.sealed ? <CircleCheck size={16} className="good" aria-label="matches seal" /> : <CircleX size={16} className="bad" aria-label="doesn't match seal" />}
                </div>
              )
            })}
          </div>
          {paperRows.length < x.paper.length && (
            <button className="btn btn-ghost btn-sm paper-more" onClick={() => setShowAllPaper(true)}>
              {t("exam.paperAll", { n: x.paper.length })}
            </button>
          )}
        </section>
      )}

      <details className="card verify-card" data-tour="verify">
        <summary>
          <Terminal size={16} /> {t("exam.verify")}
        </summary>
        <p className="muted small">{t("exam.verifyHint")}</p>
        <div className="verify">
          <div className="verify-row">
            <div className="row-between">
              <b className="small">check.html</b>
              <a className="btn btn-ghost btn-sm" href={`check.html?exam=${encodeURIComponent(examId)}`} target="_blank" rel="noopener">
                {t("exam.checker")}
              </a>
            </div>
            <p className="muted small">{t("exam.checkerHint")}</p>
          </div>
          {(sealed ? (["commits", "reveals", "witnesses"] as const) : (["openExam", "witnesses"] as const)).map((k) => {
            const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "arkiv_query", params: [QUERIES[k](examId), { select: { key: true, creator: true, createdAt: true, attributes: true, payload: true } }] })
            const cmd = `curl -s ${RPC} -H 'content-type: application/json' -d '${body.replace(/'/g, "'\\''")}'`
            return (
              <div key={k} className="verify-row">
                <div className="row-between">
                  <b className="small">{k}</b>
                  <CopyButton value={cmd} label="Copy command" />
                </div>
                <pre className="code">{cmd}</pre>
              </div>
            )
          })}
          <div className="verify-row">
            <div className="row-between">
              <b className="small">mohar-verify</b>
              <CopyButton value={`npx mohar-verify ${examId}`} label="Copy command" />
            </div>
            <pre className="code">npx mohar-verify {examId}</pre>
          </div>
        </div>
      </details>

      {witnessOpen && (
        <WitnessSheet key={prefill ?? "manual"} open onClose={() => (setWitnessOpen(false), setPrefill(undefined))} examId={exam.examId} examTitle={exam.title} deadlineMs={x.deadlineMs} onSealed={x.reload} prefill={prefill} />
      )}
      <EvidenceDrawer
        row={pickedRow?.w}
        verdict={pickedRow?.v}
        hasPaper={x.hasPaper}
        examTitle={exam.title}
        msLeft={pickedRow ? msUntilBlock(pickedRow.w.expiresAt) : NaN}
        onClose={() => {
          setPicked(undefined)
          const url = new URL(location.href)
          if (url.searchParams.has("w")) {
            url.searchParams.delete("w")
            history.replaceState(null, "", url)
          }
        }}
        onChanged={x.reload}
      />
    </div>
  )
}

function BackLink({ href }: { href: string }) {
  const { t } = useT()
  return (
    <a className="back" href={href}>
      <ArrowLeft size={16} /> {t("exam.back")}
    </a>
  )
}

function ExamSkeleton({ homeHref }: { homeHref: string }) {
  return (
    <>
      <BackLink href={homeHref} />
      <div className="exam-head">
        <div className="grow stack-xs">
          <Skeleton w={140} h={22} r={999} />
          <Skeleton w="60%" h={34} />
          <Skeleton w="40%" h={14} />
        </div>
      </div>
      <Skeleton h={64} r={14} />
      <section className="stats" style={{ marginTop: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat">
            <Skeleton w="50%" h={12} />
            <Skeleton w="40%" h={26} />
          </div>
        ))}
      </section>
      <div className="card">
        <Skeleton h={140} r={10} />
      </div>
    </>
  )
}
