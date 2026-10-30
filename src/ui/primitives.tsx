import { Check, Copy, ExternalLink, LoaderCircle, X } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { type Toast, ToastCtx } from "./toast"
import { EXPLORER, short } from "./format"

export function Spinner({ size = 16 }: { size?: number }) {
  return <LoaderCircle size={size} className="spin" aria-hidden />
}

export function Skeleton({ w = "100%", h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: r }} aria-hidden />
}

export type { Tone } from "./toast"
import type { Tone } from "./toast"
export function Badge({ tone = "neutral", icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      {icon}
      {children}
    </span>
  )
}

// a state written as coloured text; the pill Badge is for the few labels that have to stand out
export function Tag({ tone = "neutral", icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`tag tag-${tone}`}>
      {icon}
      {children}
    </span>
  )
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={done ? "Copied" : label}
      title={done ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1400)
        } catch {
          /* clipboard blocked, nothing to do */
        }
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

export function Mono({ value, kind, head, tail }: { value: string; kind?: "address" | "entity" | "tx"; head?: number; tail?: number }) {
  const href = kind === "address" ? `${EXPLORER}/address/${value}` : kind === "entity" ? `${EXPLORER}/entity/${value}` : kind === "tx" ? `${EXPLORER}/tx/${value}` : undefined
  return (
    <span className="mono-chip">
      <code title={value} translate="no">{short(value, head, tail)}</code>
      <CopyButton value={value} />
      {href && (
        <a className="icon-btn" href={href} target="_blank" rel="noreferrer" aria-label="Open in explorer" title="Open in explorer">
          <ExternalLink size={13} />
        </a>
      )}
    </span>
  )
}

// a real button that opens a file picker, so it can be reached and pressed from the keyboard
export function FileButton({ className, accept, capture, disabled, onFile, children }: { className: string; accept: string; capture?: "environment"; disabled?: boolean; onFile: (f: File) => void; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        capture={capture}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          // so picking the same file again still fires
          e.target.value = ""
          if (f) onFile(f)
        }}
      />
    </>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {children && <div className="empty-body">{children}</div>}
    </div>
  )
}

export function Sheet({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    panel.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-root" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
        <header className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button className="icon-btn lg" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}


export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts, { ...t, id }].slice(-4))
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
