import type { WalletArkivClient } from "@arkiv-network/sdk"
import { ArrowLeft, BadgeCheck, Download, FileUp, Lock, ShieldAlert, Unlock, Wallet } from "lucide-react"
import { useMemo, useState } from "react"
import { formatEther, type Hex } from "viem"
import { reader, useNow } from "../hooks/useChain"
import { useT } from "../i18n"
import { burner } from "../lib/burner"
import { parsePaperCsv } from "../lib/csv"
import { connectInjected, hasInjectedWallet } from "../lib/injected"
import { DAY_MS, ISSUERS, revealExam, type SealSecrets, sealExam } from "../lib/mohar"
import { errText, fmtDateTime, fmtDuration } from "./format"
import { Badge, FileButton, Mono, Spinner } from "./primitives"
import { useToast } from "./toast"

type Saved = SealSecrets & { opensAtMs: number; issuer: string; title: string }

const istToMs = (local: string) => Date.parse(`${local}:00+05:30`)
const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)

function download(saved: Saved) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" }))
  const a = Object.assign(document.createElement("a"), { href: url, download: `mohar-salts-${saved.examId}.json` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function IssuerPage({ homeHref }: { homeHref: string }) {
  const { t } = useT()
  const toast = useToast()
  const now = useNow(1000)
  const [tab, setTab] = useState<"seal" | "reveal">("seal")
  const [wallet, setWallet] = useState<WalletArkivClient>()
  const [balance, setBalance] = useState<bigint>()
  const [title, setTitle] = useState("")
  const [examId, setExamId] = useState("")
  const [start, setStart] = useState("")
  const [shift, setShift] = useState(1)
  const [csv, setCsv] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()
  const [sealed, setSealed] = useState<{ saved: Saved; tx: Hex }>()
  const [loaded, setLoaded] = useState<Saved>()
  const [revealed, setRevealed] = useState<Hex>()

  const address = wallet?.account?.address
  const registered = !!address && Object.keys(ISSUERS).some((a) => a.toLowerCase() === address.toLowerCase())
  const paper = useMemo(() => {
    if (!csv.trim()) return { sets: [] as ReturnType<typeof parsePaperCsv>, error: undefined }
    try {
      return { sets: parsePaperCsv(csv), error: undefined }
    } catch (e) {
      return { sets: [], error: errText(e) }
    }
  }, [csv])
  const total = paper.sets.reduce((n, s) => n + s.questions.length, 0)
  const opensAtMs = start ? istToMs(start) : NaN
  const id = examId || slug(title)
  const ready = !!wallet && title.trim().length >= 4 && /^[A-Za-z0-9._-]{3,100}$/.test(id) && opensAtMs > now && total > 0 && !paper.error

  const use = async (pick: "metamask" | "burner") => {
    setErr(undefined)
    try {
      const w = pick === "metamask" ? await connectInjected() : burner()
      setWallet(w)
      reader.getBalance({ address: w.account!.address }).then(setBalance).catch(() => undefined)
    } catch (e) {
      setErr(errText(e))
    }
  }

  const seal = async () => {
    if (!wallet || !ready) return
    setBusy(true)
    setErr(undefined)
    try {
      const res = await sealExam(wallet, { examId: id, title: title.trim(), shift, opensAtMs, sets: paper.sets })
      const saved: Saved = { ...res.secrets, opensAtMs, issuer: address!, title: title.trim() }
      setSealed({ saved, tx: res.txHash })
      download(saved)
      toast({ tone: "good", title: t("iss.sealed") })
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const loadSalts = async (file: File) => {
    setErr(undefined)
    setRevealed(undefined)
    try {
      const saved = JSON.parse(await file.text()) as Saved
      if (!saved.examId || !Array.isArray(saved.sets) || !saved.opensAtMs) throw new Error("That isn't a Mohar salts file")
      setLoaded(saved)
    } catch (e) {
      setErr(errText(e))
    }
  }

  const reveal = async () => {
    if (!wallet || !loaded) return
    setBusy(true)
    setErr(undefined)
    try {
      const res = await revealExam(wallet, loaded, loaded.opensAtMs)
      setRevealed(res.txHash)
      toast({ tone: "good", title: t("iss.revealed") })
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const examLink = (examId: string, issuer: string) => `?exam=${encodeURIComponent(examId)}${ISSUERS[issuer] ? "" : `&issuer=${issuer}`}`

  return (
    <div className="issuer">
      <a className="back" href={homeHref}>
        <ArrowLeft size={16} /> {t("exam.back")}
      </a>
      <header className="exam-head">
        <div className="grow">
          <h1>{t("iss.title")}</h1>
          <p className="muted">{t("iss.lead")}</p>
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>
            <Wallet size={16} /> {t("iss.wallet")}
          </h2>
          {address && (registered ? <Badge tone="good" icon={<BadgeCheck size={12} />}>{t("iss.registered")}</Badge> : null)}
        </div>
        {address ? (
          <div className="stack-xs">
            <div className="row-gap">
              <Mono value={address} kind="address" />
              {balance !== undefined && <Badge>{Number(formatEther(balance)).toFixed(3)} GLM</Badge>}
            </div>
            {!registered && (
              <p className="small warn-text">
                <ShieldAlert size={14} /> {t("iss.unregistered")}
              </p>
            )}
          </div>
        ) : (
          <div className="row-gap">
            {hasInjectedWallet() && (
              <button className="btn btn-primary" onClick={() => use("metamask")}>
                {t("iss.metamask")}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => use("burner")}>
              {t("iss.burner")}
            </button>
          </div>
        )}
      </section>

      <div className="seg issuer-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "seal"} className={tab === "seal" ? "on" : ""} onClick={() => setTab("seal")}>
          <Lock size={14} /> {t("iss.tabSeal")}
        </button>
        <button role="tab" aria-selected={tab === "reveal"} className={tab === "reveal" ? "on" : ""} onClick={() => setTab("reveal")}>
          <Unlock size={14} /> {t("iss.tabReveal")}
        </button>
      </div>

      {err && <div className="callout callout-danger">{err}</div>}

      {tab === "seal" && !sealed && (
        <section className="card stack">
          <div className="form-grid">
            <label className="field">
              <span className="field-label">{t("iss.examTitle")}</span>
              <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="UPPSC Prelims 2026, Shift 1" />
            </label>
            <label className="field">
              <span className="field-label">{t("iss.examId")}</span>
              <input className="input mono-input" value={examId} spellCheck={false} autoComplete="off" placeholder={slug(title) || "UPPSC-PRE-2026-S1"} onChange={(e) => setExamId(e.target.value.trim())} />
              <span className="field-hint">{t("iss.examIdHint")}</span>
            </label>
            <label className="field">
              <span className="field-label">{t("add.start")}</span>
              <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              {Number.isFinite(opensAtMs) && opensAtMs <= now && <span className="bad small">{t("add.past")}</span>}
            </label>
            <label className="field">
              <span className="field-label">{t("iss.shift")}</span>
              <input className="input" type="number" min={1} max={9} value={shift} onChange={(e) => setShift(Math.max(1, Math.min(9, Number(e.target.value) || 1)))} />
            </label>
          </div>
          <div className="field">
            <div className="row-between">
              <span className="field-label">{t("iss.csv")}</span>
              <span className="row-gap small">
                <a href="./sample-paper.csv" download>
                  {t("iss.sample")}
                </a>
                <label className="link">
                  <FileUp size={13} /> {t("iss.upload")}
                  <input type="file" accept=".csv,text/csv" hidden onChange={async (e) => e.target.files?.[0] && setCsv(await e.target.files[0].text())} />
                </label>
              </span>
            </div>
            <span className="field-hint">{t("iss.csvHint")}</span>
            <textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"set,question\nA-en,Which river is known as the Dakshin Ganga?\nA-hi,किस नदी को दक्षिण गंगा कहा जाता है?"} />
            {paper.error && <span className="bad small">{paper.error}</span>}
          </div>
          {total > 0 && (
            <div className="paper">
              <div className="pq">
                <b>{t("iss.preview", { n: total })}</b>
              </div>
              {paper.sets.map((s) => (
                <div key={s.code} className="pq">
                  <span className="pq-n">{s.code}</span>
                  <span className="grow ellipsis">{s.questions[0]}</span>
                  <Badge>{s.questions.length} Q</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="row-between">
            <span className="muted small">{Number.isFinite(opensAtMs) ? fmtDateTime(opensAtMs) : ""}</span>
            <button className="btn btn-primary" disabled={!ready || busy} onClick={seal} title={wallet ? undefined : t("iss.needWallet")}>
              {busy ? <Spinner /> : <Lock size={16} />} {busy ? t("iss.sealing") : t("iss.seal")}
            </button>
          </div>
        </section>
      )}

      {tab === "seal" && sealed && (
        <section className="card stack">
          <div className="callout">
            <BadgeCheck size={16} />
            <div>
              <b>{t("iss.sealed")}</b> <Mono value={sealed.tx} kind="tx" />
            </div>
          </div>
          <div className="callout callout-warn">{t("iss.saltsWarn")}</div>
          <div className="row-gap">
            <button className="btn btn-primary" onClick={() => download(sealed.saved)}>
              <Download size={16} /> {t("iss.download")}
            </button>
            <a className="btn btn-secondary" href={examLink(sealed.saved.examId, sealed.saved.issuer)}>
              {t("iss.openExam")}
            </a>
          </div>
        </section>
      )}

      {tab === "reveal" && (
        <section className="card stack">
          <p className="muted">{t("iss.revealLead")}</p>
          <FileButton className="btn btn-secondary file-btn" accept="application/json,.json" onFile={loadSalts}>
            <FileUp size={16} /> {t("iss.loadSalts")}
          </FileButton>
          {loaded && (
            <>
              <dl className="kv">
                <dt>{t("w.exam")}</dt>
                <dd>{loaded.title ?? loaded.examId}</dd>
                <dt>{t("iss.examId")}</dt>
                <dd>
                  <code>{loaded.examId}</code>
                </dd>
                <dt>{t("exam.opens")}</dt>
                <dd>{fmtDateTime(loaded.opensAtMs)}</dd>
                <dt>{t("iss.csv")}</dt>
                <dd>{loaded.sets.map((s) => `${s.code} (${s.questions.length})`).join(", ")}</dd>
              </dl>
              {now < loaded.opensAtMs && <div className="callout callout-warn">{t("iss.tooEarly", { t: fmtDuration(loaded.opensAtMs - now) })}</div>}
              {revealed ? (
                <div className="callout">
                  <BadgeCheck size={16} />
                  <div>
                    <b>{t("iss.revealed")}</b> <Mono value={revealed} kind="tx" />{" "}
                    <a href={examLink(loaded.examId, loaded.issuer)}>{t("iss.openExam")}</a>
                  </div>
                </div>
              ) : (
                <button className="btn btn-primary" disabled={!wallet || busy || now < loaded.opensAtMs || now > loaded.opensAtMs + 30 * DAY_MS} onClick={reveal}>
                  {busy ? <Spinner /> : <Unlock size={16} />} {busy ? t("iss.revealing") : t("iss.revealNow")}
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
