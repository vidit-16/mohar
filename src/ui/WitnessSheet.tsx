import { ChevronDown, EyeOff, Fingerprint, Lock, RefreshCw, Share2 } from "lucide-react"
import { useState } from "react"
import { formatEther, type Hex } from "viem"
import { useBurnerBalance } from "../hooks/useBurnerBalance"
import { reader, useNow } from "../hooks/useChain"
import { useT } from "../i18n"
import { burner, type BurnerKind, retireWitnessWallet } from "../lib/burner"
import { normalise, questionHash, splitQuestions } from "../lib/hash"
import { witnessPaper } from "../lib/mohar"
import { Emblem } from "./brand"
import { errText, FAUCET, fmtDateTime } from "./format"
import { CopyButton, Mono, Sheet, Spinner } from "./primitives"
import { useToast } from "./toast"

type Props = { open: boolean; onClose: () => void; examId: string; examTitle: string; deadlineMs: number; onSealed: () => void; prefill?: string }
type Receipt = { key: Hex; tx: Hex; at: number; block?: bigint }

// The moment a witness is sealed should feel like a stamp landing: a short thud and a buzz on phones that have one.
// Synthesised on the spot (no audio file to download), quiet, and only ever after the person pressed Seal.
function stampFeedback() {
  try {
    navigator.vibrate?.([14, 40, 26])
  } catch {
    /* not every browser exposes vibrate */
  }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.16)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.24)
    osc.onended = () => void ctx.close()
  } catch {
    /* sound is a nicety; the receipt is what matters */
  }
}

export function WitnessSheet({ open, onClose, examId, examTitle, deadlineMs, onSealed, prefill }: Props) {
  const { t } = useT()
  const toast = useToast()
  const [text, setText] = useState(prefill ?? "")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()
  const [receipt, setReceipt] = useState<Receipt>()
  // a fresh wallet per witness keeps one person's witnesses unlinkable; the main wallet is the fallback
  const [kind, setKind] = useState<BurnerKind>("witness")
  const { address, wei, refresh, drip } = useBurnerBalance(open, kind)
  const main = useBurnerBalance(open && kind === "witness" && drip === "failed", "main")
  const qs = splitQuestions(text)
  const now = useNow(5000)
  const late = now >= deadlineMs
  const funded = wei !== undefined && wei > 0n
  // a keyboard popping up over the sheet on a phone is worse than one more tap
  const [desktop] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches)

  const seal = async () => {
    setBusy(true)
    setErr(undefined)
    try {
      const r = await witnessPaper(burner(kind), examId, text)
      if (kind === "witness") retireWitnessWallet()
      stampFeedback()
      setReceipt({ key: r.entityKey, tx: r.txHash, at: Date.now() })
      onSealed()
      refresh()
      // the block number makes the receipt checkable by anyone; it arrives a moment later and fills in
      reader
        .getTransactionReceipt({ hash: r.txHash })
        .then((rc) => setReceipt((cur) => (cur && cur.tx === r.txHash ? { ...cur, block: rc.blockNumber } : cur)))
        .catch(() => undefined)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    const url = `${location.origin}/?exam=${encodeURIComponent(examId)}&w=${receipt?.key ?? ""}`
    try {
      if (navigator.share) await navigator.share({ title: t("w.receipt.title"), text: `${t("w.receipt.sealed")} · ${examTitle}`, url })
      else {
        await navigator.clipboard.writeText(url)
        toast({ tone: "good", title: t("w.receipt.copied") })
      }
    } catch {
      /* the person closed the share sheet */
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("w.title")} subtitle={examTitle}>
      {receipt ? (
        <div className="stack receipt">
          <div className="receipt-card" data-testid="receipt">
            <div className="receipt-stamp">
              <Emblem size={132} className="stamp-slam" />
            </div>
            <p className="receipt-sealed">{t("w.receipt.sealed")}</p>
            <h3>{examTitle}</h3>
            <p className="receipt-time">{fmtDateTime(receipt.at)}</p>
            <dl className="receipt-kv">
              <dt>{t("w.receipt.block")}</dt>
              <dd>{receipt.block !== undefined ? `#${receipt.block}` : <Spinner size={13} />}</dd>
              <dt>{t("ev.record")}</dt>
              <dd>
                <Mono value={receipt.key} kind="entity" />
              </dd>
              <dt>{t("w.tx")}</dt>
              <dd>
                <Mono value={receipt.tx} kind="tx" />
              </dd>
            </dl>
            <p className="receipt-foot">{t("w.receipt.check")}</p>
          </div>
          <p className="muted small">{t("w.done.d")}</p>
          <div className="row-gap receipt-actions">
            <button className="btn btn-secondary" onClick={() => void share()}>
              <Share2 size={16} /> {t("w.receipt.share")}
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              {t("w.done.btn")}
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          {late && <div className="callout callout-warn">{t("w.late")}</div>}
          <label className="field">
            <span className="field-label">{t("w.label")}</span>
            <span className="field-hint">{t("w.hint")}</span>
            <textarea rows={7} value={text} autoFocus={desktop && !prefill} onChange={(e) => setText(e.target.value)} placeholder={"Q3. Which river is known as the Dakshin Ganga?\nQ7. …"} />
          </label>

          <div className="witness-meta">
            <span className="muted small" aria-live="polite">
              {t("w.detected", { n: qs.length })}
            </span>
            <span className="witness-private">
              <EyeOff size={14} /> {t("w.privateShort")}
            </span>
          </div>

          {qs.length > 0 && (
            <details className="witness-details">
              <summary>
                {t("w.willWrite")} <ChevronDown size={14} />
              </summary>
              <ul className="hash-list">
                {qs.map((q, i) => (
                  <li key={i}>
                    <Fingerprint size={14} className="muted" />
                    <code>{questionHash(q).slice(0, 18)}…</code>
                    <span className="muted ellipsis" title={normalise(q)}>
                      {t("w.from")} “{normalise(q)}”
                    </span>
                  </li>
                ))}
              </ul>
              <p className="muted small">{t("w.private")}</p>
              <p className="muted small">{t("w.willWriteNote")}</p>
            </details>
          )}

          <div className={`wallet-card ${funded ? "" : "wallet-empty"}`}>
            {funded ? (
              <span className="wallet-ok">
                {t("w.ready")} <span className="muted">· {Number(formatEther(wei ?? 0n)).toFixed(3)} GLM</span>
              </span>
            ) : drip === "failed" && wei !== undefined ? (
              <div className="small fund-steps">
                {t("w.fund")} <CopyButton value={address} label="Copy address" />{" "}
                <a href={FAUCET} target="_blank" rel="noreferrer">
                  {t("w.faucet")}
                </a>{" "}
                {t("w.fundTail")}{" "}
                <button className="link" onClick={refresh}>
                  <RefreshCw size={12} /> {t("w.recheck")}
                </button>
                {kind === "witness" && main.wei !== undefined && main.wei > 0n && (
                  <div className="muted small">
                    <button className="link" onClick={() => setKind("main")}>
                      {t("w.useMain")}
                    </button>{" "}
                    {t("w.useMainNote")}
                  </div>
                )}
              </div>
            ) : (
              <span className="small">
                <Spinner size={13} /> {t("w.dripping")}
              </span>
            )}
          </div>

          {err && <div className="callout callout-danger">{err}</div>}

          <button className="btn btn-primary btn-lg btn-block" onClick={seal} disabled={busy || !funded || qs.length === 0} data-tour="seal-btn">
            {busy ? <Spinner /> : <Lock size={18} />} {busy ? t("w.sealing") : t("w.seal", { n: qs.length })}
          </button>
        </div>
      )}
    </Sheet>
  )
}
