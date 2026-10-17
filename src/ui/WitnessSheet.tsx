import { ArrowLeft, ArrowRight, CircleCheck, EyeOff, Fingerprint, Lock, RefreshCw, Wallet } from "lucide-react"
import { useEffect, useState } from "react"
import { formatEther, type Hex } from "viem"
import { useBurnerBalance } from "../hooks/useBurnerBalance"
import { useNow } from "../hooks/useChain"
import { useT } from "../i18n"
import { burner } from "../lib/burner"
import { normalise, questionHash, splitQuestions } from "../lib/hash"
import { witnessPaper } from "../lib/mohar"
import { Mark } from "./brand"
import { errText, FAUCET, fmtDateTime } from "./format"
import { Badge, CopyButton, Mono, Sheet, Spinner, useToast } from "./primitives"

type Props = { open: boolean; onClose: () => void; examId: string; examTitle: string; deadlineMs: number; onSealed: () => void; prefill?: string }

export function WitnessSheet({ open, onClose, examId, examTitle, deadlineMs, onSealed, prefill }: Props) {
  const { t } = useT()
  const toast = useToast()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()
  const [receipt, setReceipt] = useState<{ key: Hex; tx: Hex; at: number }>()
  const { address, wei, refresh } = useBurnerBalance(open)
  const qs = splitQuestions(text)
  const now = useNow(5000)
  const late = now >= deadlineMs
  const funded = wei !== undefined && wei > 0n

  useEffect(() => {
    if (open && prefill) {
      setText(prefill)
      setStep(2)
    }
  }, [open, prefill])

  const close = () => {
    onClose()
    if (step === 3) {
      setStep(1)
      setText("")
      setReceipt(undefined)
    }
  }

  const seal = async () => {
    setBusy(true)
    setErr(undefined)
    try {
      const r = await witnessPaper(burner(), examId, text)
      setReceipt({ key: r.entityKey, tx: r.txHash, at: Date.now() })
      setStep(3)
      onSealed()
      refresh()
      toast({ tone: "good", title: t("w.toast"), body: t("w.toastBody") })
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={close} title={t("w.title")} subtitle={examTitle}>
      <ol className="stepper">
        {[t("w.step1"), t("w.step2"), t("w.step3")].map((s, i) => (
          <li key={s} className={step === i + 1 ? "current" : step > i + 1 ? "done" : ""}>
            <span>{step > i + 1 ? <CircleCheck size={14} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {late && step < 3 && <div className="callout callout-warn">{t("w.late")}</div>}

      {step === 1 && (
        <div className="stack">
          <label className="field">
            <span className="field-label">{t("w.label")}</span>
            <span className="field-hint">{t("w.hint")}</span>
            <textarea rows={8} value={text} autoFocus onChange={(e) => setText(e.target.value)} placeholder={"Q3. Which river is known as the Dakshin Ganga?\nQ7. …"} />
          </label>
          <div className="callout">
            <EyeOff size={16} />
            <div>{t("w.private")}</div>
          </div>
          <div className="row-end">
            <span className="muted small">{t("w.detected", { n: qs.length })}</span>
            <button className="btn btn-primary" disabled={qs.length === 0} onClick={() => setStep(2)}>
              {t("w.next")} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <div>
            <div className="field-label">{t("w.willWrite")}</div>
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
            <p className="muted small">{t("w.willWriteNote")}</p>
          </div>

          <div className={`wallet-card ${funded ? "" : "wallet-empty"}`}>
            <Wallet size={18} />
            <div className="grow">
              <div className="wallet-title">
                {t("w.wallet")} <Badge tone={funded ? "good" : "warn"}>{wei === undefined ? "…" : `${Number(formatEther(wei)).toFixed(3)} GLM`}</Badge>
              </div>
              <div className="muted small">
                {t("w.walletNote")} <Mono value={address} kind="address" />
              </div>
              {!funded && wei !== undefined && (
                <div className="small fund-steps">
                  {t("w.fund")} <CopyButton value={address} label="Copy address" />{" "}
                  <a href={FAUCET} target="_blank" rel="noreferrer">
                    {t("w.faucet")}
                  </a>{" "}
                  {t("w.fundTail")}{" "}
                  <button className="link" onClick={refresh}>
                    <RefreshCw size={12} /> {t("w.recheck")}
                  </button>
                </div>
              )}
            </div>
          </div>

          {err && <div className="callout callout-danger">{err}</div>}

          <div className="row-between">
            <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={busy}>
              <ArrowLeft size={16} /> {t("w.edit")}
            </button>
            <button className="btn btn-primary" onClick={seal} disabled={busy || !funded} data-tour="seal-btn">
              {busy ? <Spinner /> : <Lock size={16} />} {busy ? t("w.sealing") : t("w.seal", { n: qs.length })}
            </button>
          </div>
        </div>
      )}

      {step === 3 && receipt && (
        <div className="stack receipt">
          <div className="receipt-stamp">
            <Mark size={84} className="stamp-in" />
          </div>
          <h3>{t("w.done.t")}</h3>
          <p className="muted">{t("w.done.d")}</p>
          <dl className="kv">
            <dt>{t("w.exam")}</dt>
            <dd>{examId}</dd>
            <dt>{t("ev.record")}</dt>
            <dd>
              <Mono value={receipt.key} kind="entity" />
            </dd>
            <dt>{t("w.tx")}</dt>
            <dd>
              <Mono value={receipt.tx} kind="tx" />
            </dd>
            <dt>{t("w.submitted")}</dt>
            <dd>{fmtDateTime(receipt.at)}</dd>
          </dl>
          <button className="btn btn-primary" onClick={close}>
            {t("w.done.btn")}
          </button>
        </div>
      )}
    </Sheet>
  )
}
