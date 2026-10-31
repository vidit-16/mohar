import { Link2, Printer, Square, Volume2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useNow } from "../hooks/useChain"
import { useT } from "../i18n"
import { burner } from "../lib/burner"
import { keepAlive, type Row, type Verdict, type WitnessPayload } from "../lib/mohar"
import { errText, fmtDateTime, fmtDuration } from "./format"
import { Badge, Mono, Sheet, Spinner } from "./primitives"
import { canSpeak, speakAll } from "./speech"
import { useToast } from "./toast"
import { describe } from "./verdict"
import { LacSeal } from "./brand"

type Props = {
  row?: Row
  verdict?: Verdict
  hasPaper: boolean
  examTitle: string
  msLeft: number
  onClose: () => void
  onChanged: () => void
}

export function EvidenceDrawer({ row, verdict, hasPaper, examTitle, msLeft, onClose, onChanged }: Props) {
  const { t } = useT()
  const toast = useToast()
  const now = useNow(10_000)
  if (!row) return null
  const n = (row.json as WitnessPayload | null)?.hashes?.length ?? 0
  const d = describe(t, verdict, hasPaper, n)
  const future = verdict ? verdict.deadlineMs > now : false

  const share = async () => {
    const url = new URL(location.href)
    url.searchParams.set("w", row.key)
    url.searchParams.delete("tour")
    url.searchParams.delete("step")
    try {
      await navigator.clipboard.writeText(url.toString())
      toast({ tone: "good", title: t("ev.shared") })
    } catch {
      prompt(t("ev.share"), url.toString())
    }
  }

  return (
    <Sheet open onClose={onClose} title={t("ev.title")} subtitle={examTitle}>
      <div className="stack printable" data-tour="evidence">
        <div className={`verdict-hero tone-${d.tone}`}>
          <Badge tone={d.tone}>{d.short}</Badge>
          <h3>{d.title}</h3>
          <p>{d.explain}</p>
          {d.kind === "leak" && <LacSeal size={92} className="verdict-seal" label={t("hero.app.sealLabel")} />}
        </div>

        {verdict && (
          <div className="compare">
            <div>
              <div className="stat-label">{t("ev.sealedAt")}</div>
              <div className="mono-strong">{fmtDateTime(verdict.witnessedAtMs)}</div>
            </div>
            <div>
              <div className="stat-label">{future ? t("ev.deadlineFuture") : t("ev.deadline")}</div>
              <div className="mono-strong">{fmtDateTime(verdict.deadlineMs)}</div>
            </div>
            <div className={`compare-delta tone-${verdict.before ? "good" : "warn"}`}>
              {fmtDuration(verdict.deadlineMs - verdict.witnessedAtMs)} {verdict.before ? t("v.before") : t("v.after")}
            </div>
          </div>
        )}

        {verdict && verdict.matches.length > 0 && (
          <div data-tour="matches">
            <div className="row-between">
              <div className="field-label">{t("ev.matched")}</div>
              {canSpeak() && <ReadAloud parts={[d.title, ...verdict.matches.map((m) => m.text)]} />}
            </div>
            <ul className="match-list">
              {verdict.matches.map((m) => (
                <li key={`${m.set}${m.index}`}>
                  <Badge tone="danger">{m.set ? `${m.set}-Q${m.index}` : `Q${m.index}`}</Badge>
                  <span>{m.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="row-gap no-print">
          <button className="btn btn-secondary btn-sm" onClick={share}>
            <Link2 size={14} /> {t("ev.share")}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={14} /> {t("ev.print")}
          </button>
        </div>

        <details className="tech">
          <summary>{t("exam.tech")}</summary>
          <dl className="kv">
            <dt>{t("ev.fingerprints")}</dt>
            <dd>{n}</dd>
            <dt>{t("ev.signedBy")}</dt>
            <dd>
              <Mono value={row.creator} kind="address" />
            </dd>
            <dt>{t("ev.block")}</dt>
            <dd>{String(row.createdAt)}</dd>
            <dt>{t("ev.record")}</dt>
            <dd>
              <Mono value={row.key} kind="entity" />
            </dd>
            <dt>{t("ev.flags")}</dt>
            <dd className="row-gap">
              {row.readonly && <Badge>{t("ev.readonly")}</Badge>}
              {row.extendable && <Badge tone="info">{t("ev.extendable")}</Badge>}
            </dd>
          </dl>
        </details>

        <KeepAlive row={row} msLeft={msLeft} onDone={onChanged} />
      </div>
    </Sheet>
  )
}

export function KeepAlive({ row, msLeft, onDone, compact }: { row: Row; msLeft: number; onDone: () => void; compact?: boolean }) {
  const { t } = useT()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const soon = msLeft < 3 * 24 * 3_600_000
  return (
    <div className={`keepalive no-print ${compact ? "compact" : ""}`}>
      <div className="keepalive-info">
        <span>{Number.isNaN(msLeft) ? "…" : msLeft <= 0 ? t("ev.expired") : `${t("ev.expires")} ${fmtDuration(msLeft)}`}</span>
        {soon && msLeft > 0 && <Badge tone="warn">{t("ev.soon")}</Badge>}
      </div>
      {row.extendable && (
        <button
          className="btn btn-secondary btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await keepAlive(burner(), row.key, row.expiresAt)
              toast({ tone: "good", title: t("ev.kept") })
              onDone()
            } catch (e) {
              toast({ tone: "danger", title: t("ev.keepFail"), body: errText(e) })
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy && <Spinner size={14} />} {t("ev.keep")}
        </button>
      )}
    </div>
  )
}

function ReadAloud({ parts }: { parts: string[] }) {
  const { t } = useT()
  const [on, setOn] = useState(false)
  useEffect(() => () => speechSynthesis.cancel(), [])
  const toggle = () => {
    if (on) {
      speechSynthesis.cancel()
      setOn(false)
      return
    }
    setOn(true)
    speakAll(parts, 0.95, () => setOn(false))
  }
  return (
    <button className="btn btn-ghost btn-sm no-print" onClick={toggle} aria-pressed={on}>
      {on ? <Square size={14} /> : <Volume2 size={14} />} {on ? t("ev.stop") : t("ev.listen")}
    </button>
  )
}
