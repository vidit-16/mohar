import { ArrowRight, BadgeCheck, ChevronRight, Clock, Globe, Lock, Play, Plus, Search, Stamp, Terminal, Unlock, Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { Address } from "viem"
import { reader, useNow } from "../hooks/useChain"
import { useT } from "../i18n"
import { examHref, navigate } from "../router"
import { DAY_MS, type Exam, examsFrom, groupExams, openExamFrom, openExamsSince } from "../lib/mohar"
import { AddExamSheet } from "./AddExamSheet"
import { Emblem, Mark } from "./brand"
import { errText, fmtDateTime, fmtRelative, REPO } from "./format"
import { Badge, Empty, Skeleton } from "./primitives"
import { DEMO_EXAM, tourHref } from "./tourSteps"

type Tab = "sealed" | "open"

export function Home({ issuer, issuerName }: { issuer: Address; issuerName: string }) {
  const { t } = useT()
  const [sealed, setSealed] = useState<Exam[]>()
  const [open, setOpen] = useState<Exam[]>()
  const [err, setErr] = useState<string>()
  const [q, setQ] = useState("")
  const [tab, setTab] = useState<Tab>("sealed")
  const [adding, setAdding] = useState(false)
  const now = useNow(30_000)

  const load = () => {
    const since = Date.now() - 30 * DAY_MS
    Promise.all([examsFrom(reader, issuer, since), openExamsSince(reader, since)])
      .then(([commits, entries]) => {
        setSealed(groupExams(commits, issuer).sort((a, b) => b.opensAtMs - a.opensAtMs))
        const byId = new Map<string, typeof entries>()
        for (const e of entries) byId.set(String(e.attrs.exam_id), [...(byId.get(String(e.attrs.exam_id)) ?? []), e])
        setOpen([...byId.values()].map((es) => openExamFrom(es)!).sort((a, b) => a.opensAtMs - b.opensAtMs))
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

  return (
    <>
      <section className="hero bleed">
        <div className="hero-copy">
          <div className="eyebrow">
            <Mark size={18} />
            {t("hero.badge")}
          </div>
          <h1>
            {t("hero.title1")} <em>{t("hero.title2")}</em> {t("hero.title3")}
          </h1>
          <p className="lead">{t("hero.lead")}</p>
          <div className="hero-cta">
            <a className="btn btn-primary btn-lg" href={tourHref(0)} data-tour="tour-btn">
              <Play size={17} /> {t("hero.tour")}
            </a>
            <a className="btn btn-ghost btn-lg" href="#exams">
              {t("hero.browse")} <ArrowRight size={17} />
            </a>
          </div>
        </div>
        <div className="hero-art">
          <Emblem size={320} animate className="hero-emblem" />
        </div>
      </section>

      <section className="proof bleed" data-tour="proof">
        <div>
          <b>41</b>
          <span>{t("proof.leaks")}</span>
        </div>
        <div>
          <b>15</b>
          <span>{t("proof.states")}</span>
        </div>
        <div>
          <b>1.4 cr</b>
          <span>{t("proof.applicants")}</span>
        </div>
        <p className="proof-src">{t("proof.src")}</p>
      </section>

      <section id="how" className="section">
        <h2>{t("how.title")}</h2>
        <div className="steps3">
          {(
            [
              [Stamp, "seal", "how.1.t", "how.1.d", "मोहर"],
              [Users, "info", "how.2.t", "how.2.d", "गवाही"],
              [Unlock, "danger", "how.3.t", "how.3.d", "निर्णय"],
            ] as const
          ).map(([Icon, tone, title, body, hi], i) => (
            <article className="step" key={title}>
              <div className={`step-icon ${tone}`}>
                <Icon size={20} />
              </div>
              <div className="step-k">
                {i + 1} · {hi}
              </div>
              <h3>{t(title)}</h3>
              <p>{t(body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="exams" className="section">
        <div className="section-head">
          <h2>{t("exams.title")}</h2>
          <label className="search">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("exams.search")} aria-label={t("exams.search")} />
          </label>
        </div>
        <div className="tabs-row">
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={tab === "sealed"} className={tab === "sealed" ? "on" : ""} onClick={() => setTab("sealed")}>
              <BadgeCheck size={14} /> {t("exams.sealed")}
            </button>
            <button role="tab" aria-selected={tab === "open"} className={tab === "open" ? "on" : ""} onClick={() => setTab("open")}>
              <Users size={14} /> {t("exams.open")}
            </button>
          </div>
          {tab === "open" && (
            <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
              <Plus size={15} /> {t("exams.add")}
            </button>
          )}
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

        <div className="card list-card">
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
                <Skeleton w={40} h={40} r={11} />
                <div className="grow stack-xs">
                  <Skeleton w="45%" h={16} />
                  <Skeleton w="30%" h={12} />
                </div>
              </div>
            ))}
          {list && shown.length === 0 && !exactId && <Empty icon={tab === "sealed" ? <Stamp size={22} /> : <Users size={22} />} title={t("exams.none")}>{tab === "open" && t("exams.noneOpen")}</Empty>}
          {exactId && (
            <a className="exam-row" href={examHref(exactId)}>
              <div className="exam-icon">
                <Search size={18} />
              </div>
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
                <div className={`exam-icon ${upcoming ? "up" : ""}`}>{upcoming ? <Clock size={18} /> : <Unlock size={18} />}</div>
                <div className="grow">
                  <div className="exam-title">{x.title}</div>
                  <div className="muted small">{fmtDateTime(x.opensAtMs)}</div>
                </div>
                <Badge tone={upcoming ? "info" : "neutral"}>{upcoming ? `${t("exams.accepting")} · ${fmtRelative(x.opensAtMs, now)}` : `${t("exams.held")} ${fmtRelative(x.opensAtMs, now)}`}</Badge>
                <ChevronRight size={18} className="muted hide-sm" />
              </a>
            )
          })}
        </div>
      </section>

      <section className="section trust band bleed" data-tour="trust">
        <h2>{t("trust.title")}</h2>
        <ul className="trust-grid">
          <li>
            <BadgeCheck size={20} />
            {t("trust.1")}
          </li>
          <li>
            <Clock size={20} />
            {t("trust.2")}
          </li>
          <li>
            <Lock size={20} />
            {t("trust.3")}
          </li>
          <li>
            <Terminal size={20} />
            {t("trust.4")}
          </li>
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
