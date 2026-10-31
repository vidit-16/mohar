import type { Hex } from "viem"
import { useT } from "../i18n"
import { fmtDate, fmtTime } from "./format"
import type { Tone } from "./primitives"

export type TimelinePoint = { key: Hex; ms: number; tone: Tone; label: string }

type Props = {
  startMs?: number
  startLabel: string
  official?: boolean
  opensAtMs: number
  deadlineMs: number
  revealMs?: number
  points: TimelinePoint[]
  now: number
  onPick?: (key: Hex) => void
}

export function Timeline({ startMs, startLabel, official = true, opensAtMs, deadlineMs, revealMs, points, now, onPick }: Props) {
  const { t } = useT()
  const upcoming = now < opensAtMs
  const start = Math.min(startMs ?? opensAtMs, ...points.map((p) => p.ms))
  const end = Math.max(opensAtMs, revealMs ?? 0, ...points.map((p) => p.ms), upcoming ? opensAtMs : Math.min(now, opensAtMs + (opensAtMs - start)))
  const span = Math.max(end - start, 60_000)
  const pad = span * 0.06
  const at = (ms: number) => `${(((ms - start + pad) / (span + 2 * pad)) * 100).toFixed(2)}%`
  const sameDay = fmtDate(start) === fmtDate(end)
  const when = (ms: number) => (sameDay ? fmtTime(ms) : fmtDate(ms))
  // dots sit above or below the line, clear of the seal on it; each takes the side whose last dot is further away,
  // so witnesses sealed close together never land on top of each other
  const lastOn = { up: -Infinity, down: -Infinity }
  const side = new Map<Hex, "up" | "down">()
  for (const p of [...points].sort((a, b) => a.ms - b.ms)) {
    const s = p.ms - lastOn.up >= p.ms - lastOn.down ? "up" : "down"
    side.set(p.key, s)
    lastOn[s] = p.ms
  }

  return (
    <div className="timeline" role="group" aria-label={t("exam.timeline")} data-tour="timeline">
      <div className="tl-track">
        <div className="tl-before" style={{ left: 0, width: at(deadlineMs) }} />
        <div className="tl-after" style={{ left: at(deadlineMs), right: 0 }} />
        <div className="tl-bell" style={{ left: at(opensAtMs) }} title={`${t("exam.opens")} ${fmtTime(opensAtMs)}`} />
        {upcoming && <div className="tl-now" style={{ left: at(now) }} />}
        {startMs !== undefined && (
          <div className={`tl-mark ${official ? "tl-seal" : "tl-entry"}`} style={{ left: at(startMs) }} title={`${startLabel} ${fmtTime(startMs)}`} />
        )}
        {revealMs !== undefined && (
          <div
            className="tl-mark tl-reveal"
            style={{ left: at(revealMs), marginLeft: Math.abs(revealMs - opensAtMs) < span * 0.03 ? 12 : undefined }}
            title={`${t("exam.paper")} ${fmtTime(revealMs)}`}
          />
        )}
        {points.map((p, i) => (
          <button
            key={p.key}
            className={`tl-dot tone-${p.tone}`}
            style={{ left: at(p.ms), top: side.get(p.key) === "up" ? "calc(50% - 21px)" : "calc(50% + 21px)", animationDelay: `${0.5 + i * 0.12}s` }}
            title={`${p.label} · ${fmtTime(p.ms)}`}
            aria-label={`${p.label}, ${fmtTime(p.ms)}`}
            onClick={() => onPick?.(p.key)}
          />
        ))}
      </div>
      <div className="tl-labels">
        {startMs !== undefined && (
          <div className="tl-label tl-label-start" style={{ left: at(startMs) }}>
            <b>{startLabel}</b>
            <span>{when(startMs)}</span>
          </div>
        )}
        <div className="tl-label" style={{ left: at(opensAtMs) }}>
          <b>{upcoming ? t("exam.opens") : t("exam.opened")}</b>
          <span>{when(opensAtMs)}</span>
        </div>
        {upcoming && Math.abs(now - opensAtMs) > span * 0.15 && Math.abs(now - (startMs ?? 0)) > span * 0.15 && (
          <div className="tl-label tl-label-now" style={{ left: at(now) }}>
            <b>{t("exam.now")}</b>
          </div>
        )}
      </div>
      <div className="tl-legend">
        <span>
          <i className="lg-before" /> {t("v.before")}
        </span>
        <span>
          <i className="lg-after" /> {t("v.after")}
        </span>
      </div>
    </div>
  )
}
