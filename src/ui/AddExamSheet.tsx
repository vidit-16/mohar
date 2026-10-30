import { Plus, Wallet } from "lucide-react"
import { useState } from "react"
import { useBurnerBalance } from "../hooks/useBurnerBalance"
import { useNow } from "../hooks/useChain"
import { useT } from "../i18n"
import { burner } from "../lib/burner"
import { createOpenExam } from "../lib/mohar"
import { errText, FAUCET } from "./format"
import { CopyButton, Mono, Sheet, Spinner } from "./primitives"

// datetime-local gives wall-clock time with no zone; exam notices are in IST, so pin it to +05:30
const istToMs = (local: string) => Date.parse(`${local}:00+05:30`)

export function AddExamSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (examId: string) => void }) {
  const { t } = useT()
  const [title, setTitle] = useState("")
  const [start, setStart] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()
  const { address, wei, refresh, drip } = useBurnerBalance(open)
  const funded = wei !== undefined && wei > 0n
  const opensAtMs = start ? istToMs(start) : NaN
  const now = useNow(10_000)
  const past = Number.isFinite(opensAtMs) && opensAtMs <= now
  const noticeOk = !notice || /^https:\/\/\S+$/.test(notice)
  const ready = title.trim().length >= 4 && Number.isFinite(opensAtMs) && !past && noticeOk && funded

  return (
    <Sheet open={open} onClose={onClose} title={t("add.title")} subtitle={t("add.lead")}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!ready) return
          setBusy(true)
          setErr(undefined)
          try {
            const r = await createOpenExam(burner(), { title: title.trim().slice(0, 100), opensAtMs, notice: notice.trim() })
            onAdded(r.examId)
          } catch (e2) {
            setErr(errText(e2))
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="field">
          <span className="field-label">{t("add.name")}</span>
          <input className="input" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder={t("add.namePh")} autoFocus={window.matchMedia?.("(pointer: fine)").matches} />
        </label>
        <label className="field">
          <span className="field-label">{t("add.start")}</span>
          <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          {past && <span className="bad small">{t("add.past")}</span>}
        </label>
        <label className="field">
          <span className="field-label">{t("add.notice")}</span>
          <input className="input" type="url" autoComplete="off" spellCheck={false} value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="https://" />
        </label>

        {!funded && drip === "dripping" && (
                <div className="small fund-steps">
                  <Spinner size={13} /> {t("w.dripping")}
                </div>
              )}
              {!funded && wei !== undefined && drip === "failed" && (
          <div className="wallet-card wallet-empty">
            <Wallet size={18} />
            <div className="small fund-steps">
              {t("w.fund")} <Mono value={address} kind="address" /> <CopyButton value={address} />{" "}
              <a href={FAUCET} target="_blank" rel="noreferrer">
                {t("w.faucet")}
              </a>{" "}
              {t("w.fundTail")}{" "}
              <button type="button" className="link" onClick={refresh}>
                {t("w.recheck")}
              </button>
            </div>
          </div>
        )}
        {err && <div className="callout callout-danger">{err}</div>}
        <button className="btn btn-primary" disabled={!ready || busy}>
          {busy ? <Spinner /> : <Plus size={16} />} {busy ? t("add.adding") : t("add.btn")}
        </button>
      </form>
    </Sheet>
  )
}
