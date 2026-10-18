import { ChevronLeft, ChevronRight, Pause, Play, Subtitles, Volume2, VolumeX, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useT } from "../i18n"
import { navigate } from "../router"
import { Emblem } from "./brand"
import { STEPS, tourHref } from "./tourSteps"
import { pickVoice } from "./speech"

type Rect = { top: number; left: number; width: number; height: number }

const pref = (k: string, fallback: boolean) => {
  try {
    const v = sessionStorage.getItem(`mohar.tour.${k}`)
    return v === null ? fallback : v === "1"
  } catch {
    return fallback
  }
}
const savePref = (k: string, v: boolean) => {
  try {
    sessionStorage.setItem(`mohar.tour.${k}`, v ? "1" : "0")
  } catch {
    /* storage blocked */
  }
}

export function Tour({ search }: { search: string }) {
  const { t, lang } = useT()
  const params = new URLSearchParams(search)
  const active = params.get("tour") === "1"
  const step = Math.max(0, Math.min(Number(params.get("step") ?? 0) || 0, STEPS.length - 1))
  const s = STEPS[step]
  const [spot, setSpot] = useState<{ step: number; rect: Rect }>()
  const [playing, setPlaying] = useState(true)
  const [voice, setVoice] = useState(() => pref("voice", false))
  const [captions, setCaptions] = useState(() => pref("captions", true))
  const [tick, setTick] = useState<{ step: number; value: number }>({ step: -1, value: 0 })
  const target = useRef<Element | null>(null)

  const exit = useCallback(() => {
    speechSynthesis.cancel()
    const p = new URLSearchParams(location.search)
    p.delete("tour")
    p.delete("step")
    window.dispatchEvent(new CustomEvent("mohar:tour", { detail: { action: "close" } }))
    navigate(`?${p.toString()}`, true)
  }, [])

  const go = useCallback(
    (n: number) => {
      if (n >= STEPS.length) return exit()
      navigate(tourHref(Math.max(0, n)), true)
    },
    [exit],
  )

  // find the step's element (data loads async, so poll), fire its action, and follow it on scroll
  useEffect(() => {
    if (!active) return
    target.current = null
    let raf = 0
    let tries = 0
    const fire = (detail: object) => window.dispatchEvent(new CustomEvent("mohar:tour", { detail }))
    if (!s.action || s.action.action !== "evidence-leak") fire({ action: "close" })
    if (s.action) fire(s.action)
    const find = setInterval(() => {
      if (s.action) fire(s.action)
      const el = s.target ? document.querySelector(s.target) : null
      if (el || ++tries > 40) {
        clearInterval(find)
        if (!el) return
        if (el instanceof HTMLDetailsElement) el.open = true
        target.current = el
        const inSheet = el.closest(".sheet-body")
        if (inSheet) el.scrollIntoView({ behavior: "smooth", block: "nearest" })
        else {
          const r = el.getBoundingClientRect()
          const top = 76
          const room = window.innerHeight - top - (document.querySelector(".tour-bar")?.getBoundingClientRect().height ?? 150) - 40
          const offset = r.height < room ? top + (room - r.height) / 2 : top
          window.scrollTo({ top: Math.max(0, r.top + window.scrollY - offset), behavior: "smooth" })
        }
        const track = () => {
          const r = el.getBoundingClientRect()
          setSpot({ step, rect: { top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 } })
          raf = requestAnimationFrame(track)
        }
        track()
      }
    }, s.action ? 400 : 150)
    return () => {
      clearInterval(find)
      cancelAnimationFrame(raf)
    }
  }, [active, step, s])

  // narration or a reading-time timer decides when to move on
  useEffect(() => {
    if (!active) return
    speechSynthesis.cancel()
    if (!playing) return
    const text = s[lang]
    const ms = Math.max(4500, text.length * (lang === "hi" ? 75 : 62))
    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (!s.end) setTimeout(() => go(step + 1), 700)
    }
    const started = Date.now()
    const tick = setInterval(() => setTick({ step, value: Math.min(1, (Date.now() - started) / ms) }), 100)
    let timer: ReturnType<typeof setTimeout> | undefined
    if (voice && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text)
      const v = pickVoice(lang)
      if (v) u.voice = v
      u.lang = lang === "hi" ? "hi-IN" : "en-IN"
      u.rate = 0.98
      u.onend = finish
      u.onerror = () => (timer = setTimeout(finish, ms))
      speechSynthesis.speak(u)
    } else timer = setTimeout(finish, ms)
    return () => {
      clearInterval(tick)
      clearTimeout(timer)
      speechSynthesis.cancel()
    }
  }, [active, step, playing, voice, lang, s, go])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return
      if (e.key === " ") {
        e.preventDefault()
        setPlaying((p) => !p)
      }
      const current = Number(new URLSearchParams(location.search).get("step") ?? 0)
      if (e.key === "ArrowRight") go(current + 1)
      if (e.key === "ArrowLeft") go(current - 1)
      if (e.key === "Escape") exit()
      if (e.key.toLowerCase() === "c") setCaptions((c) => (savePref("captions", !c), !c))
      if (e.key.toLowerCase() === "v") setVoice((v) => (savePref("voice", !v), !v))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, go, exit])

  if (!active) return null
  const rect = spot?.step === step ? spot.rect : undefined
  const progress = tick.step === step ? tick.value : 0

  return (
    <div className="tour" aria-live="polite">
      {s.end ? (
        <div className="tour-end">
          <Emblem size={180} animate />
          <p className="tour-end-line">{s[lang]}</p>
          <div className="row-gap">
            <button className="btn btn-secondary" onClick={() => go(0)}>
              <Play size={15} /> {t("tour.play")}
            </button>
            <button className="btn btn-primary" onClick={exit}>
              {t("tour.exit")}
            </button>
          </div>
        </div>
      ) : (
        rect && <div className="tour-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      )}
      {!s.end && captions && (
        <div className="tour-bar">
          <div className="tour-progress" style={{ transform: `scaleX(${playing ? progress : 0})` }} />
          <p className="tour-text">{s[lang]}</p>
          <div className="tour-controls">
            <span className="muted small">
              {step + 1} {t("tour.of")} {STEPS.length}
            </span>
            <span className="grow" />
            <button className="icon-btn lg" onClick={() => go(step - 1)} aria-label={t("tour.prev")} disabled={step === 0}>
              <ChevronLeft size={18} />
            </button>
            <button className="icon-btn lg" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t("tour.pause") : t("tour.play")}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="icon-btn lg" onClick={() => go(step + 1)} aria-label={t("tour.next")}>
              <ChevronRight size={18} />
            </button>
            <button className={`icon-btn lg ${voice ? "on" : ""}`} onClick={() => setVoice((v) => (savePref("voice", !v), !v))} aria-label={t("tour.voice")} title={`${t("tour.voice")} (V)`}>
              {voice ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button className="icon-btn lg" onClick={() => setCaptions((c) => (savePref("captions", !c), !c))} aria-label={t("tour.captions")} title={`${t("tour.captions")} (C)`}>
              <Subtitles size={18} />
            </button>
            <button className="icon-btn lg" onClick={exit} aria-label={t("tour.exit")}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
