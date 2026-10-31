import { ChevronLeft, ChevronRight, Maximize, Pause, Play, Subtitles, Volume2, VolumeX, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useT } from "../i18n"
import { navigate } from "../router"
import { LacSeal } from "./brand"
import NARRATION from "./narration.json"
import { STEPS, tourHref } from "./tourSteps"

type Rect = { top: number; left: number; width: number; height: number }

// the recorded narration (scripts/narration.ts), one clip per step and language
const clip = (lang: "en" | "hi", step: number) => `${import.meta.env.BASE_URL}tour/${NARRATION[lang][step]}`
// one player for the whole tour: phones only let a page play sound on an element first started by a tap
let narrator: HTMLAudioElement | undefined
const player = () => (narrator ??= new Audio())

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

const toggleFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
  else document.documentElement.requestFullscreen?.().catch(() => undefined)
}

export function Tour({ search }: { search: string }) {
  const { t, lang } = useT()
  const params = new URLSearchParams(search)
  const active = params.get("tour") === "1"
  const step = Math.max(0, Math.min(Number(params.get("step") ?? 0) || 0, STEPS.length - 1))
  const s = STEPS[step]
  const [spot, setSpot] = useState<{ step: number; rect: Rect }>()
  // recording mode: a clean start screen, captions only, and a pace you can read aloud
  const rec = params.get("rec") === "1"
  const [started, setStarted] = useState(!rec)
  const [playing, setPlaying] = useState(true)
  const [voice, setVoice] = useState(() => pref("voice", true))
  const [captions, setCaptions] = useState(() => pref("captions", true))
  const [tick, setTick] = useState<{ step: number; value: number }>({ step: -1, value: 0 })
  const target = useRef<Element | null>(null)


  const exit = useCallback(() => {
    narrator?.pause()
    const p = new URLSearchParams(location.search)
    p.delete("tour")
    p.delete("step")
    window.dispatchEvent(new CustomEvent("mohar:tour", { detail: { action: "close" } }))
    navigate(`?${p.toString()}`, true)
  }, [])

  const toggleVoice = useCallback(() => {
    if (!voice) player().play().catch(() => undefined)
    setVoice(!voice)
    savePref("voice", !voice)
  }, [voice])

  // the tap that starts the tour also starts its voice, which is what lets phones play the rest of it
  useEffect(() => {
    const onTap = (e: MouseEvent) => {
      if (!pref("voice", true) || !(e.target instanceof Element) || !e.target.closest('a[href*="tour=1"]')) return
      const a = player()
      a.src = clip(lang, 0)
      a.play().catch(() => undefined)
    }
    document.addEventListener("click", onTap, true)
    return () => document.removeEventListener("click", onTap, true)
  }, [lang])

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
        // centre the target in the space the caption bar leaves free, in the page or in the evidence sheet
        const bar = document.querySelector(".tour-bar")?.getBoundingClientRect().height ?? 150
        const sheet = el.closest(".sheet-body")
        const r = el.getBoundingClientRect()
        const top = sheet ? sheet.getBoundingClientRect().top + 12 : 76
        const room = window.innerHeight - top - bar - 40
        const offset = r.height < room ? top + (room - r.height) / 2 : top
        if (sheet) sheet.scrollTo({ top: Math.max(0, sheet.scrollTop + r.top - offset), behavior: "smooth" })
        else window.scrollTo({ top: Math.max(0, r.top + window.scrollY - offset), behavior: "smooth" })
        // a seal that hangs off its card's corner belongs inside the highlight too
        const parts = [el, ...el.querySelectorAll(".meaning-seal, .leak-card-seal, .verdict-seal")]
        const track = () => {
          const rs = parts.map((p) => p.getBoundingClientRect()).filter((b) => b.width > 0)
          const t0 = Math.min(...rs.map((b) => b.top)), l0 = Math.min(...rs.map((b) => b.left))
          const b0 = Math.max(...rs.map((b) => b.bottom)), r0 = Math.max(...rs.map((b) => b.right))
          setSpot({ step, rect: { top: t0 - 8, left: l0 - 8, width: r0 - l0 + 16, height: b0 - t0 + 16 } })
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

  // the page and the evidence sheet get room at the bottom, so even their last items can rise above the caption bar
  useEffect(() => {
    if (!active) return
    document.documentElement.classList.add("tour-on")
    return () => document.documentElement.classList.remove("tour-on")
  }, [active])

  // recording mode: no scrollbar, and the page knows a subtitle strip sits at the bottom
  useEffect(() => {
    if (!active || !rec) return
    document.documentElement.classList.add("tour-rec")
    return () => document.documentElement.classList.remove("tour-rec")
  }, [active, rec])

  // narration or a reading-time timer decides when to move on
  useEffect(() => {
    if (!active || !playing || !started) return
    const text = s[lang]
    // reading pace by default; recording mode leaves time to say the line out loud (~150 words a minute)
    const ms = Math.max(rec ? 5000 : 4500, text.length * (rec ? (lang === "hi" ? 95 : 80) : lang === "hi" ? 75 : 62))
    // set when this step is left: a clip replaced by the next step's rejects late, and must not move the tour again
    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (!s.end) setTimeout(() => go(step + 1), 700)
    }
    const startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    const a = voice ? player() : null
    // the tap that opened the tour may already be playing this clip
    if (a && !a.src.endsWith(NARRATION[lang][step])) a.src = clip(lang, step)
    // with narration the bar follows the clip; without, the reading time
    const tick = setInterval(() => setTick({ step, value: a?.duration ? a.currentTime / a.duration : Math.min(1, (Date.now() - startedAt) / ms) }), 100)
    if (a) {
      const fallback = () => {
        if (!done) timer = setTimeout(finish, ms)
      }
      a.onended = finish
      a.onerror = fallback
      a.play().catch(fallback)
      // the next clip is fetched while this one plays, so the next step speaks at once
      if (step + 1 < STEPS.length) fetch(clip(lang, step + 1)).catch(() => undefined)
    } else timer = setTimeout(finish, ms)
    return () => {
      done = true
      clearInterval(tick)
      clearTimeout(timer)
      if (a) {
        a.pause()
        a.onended = a.onerror = null
      }
    }
  }, [active, step, playing, started, rec, voice, lang, s, go])

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
      if (e.key.toLowerCase() === "v") toggleVoice()
      if (e.key.toLowerCase() === "f") toggleFullscreen()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, go, exit, toggleVoice])

  if (!active) return null
  if (!started)
    return (
      <div className="tour">
        <button
          className="tour-rec-start"
          onClick={() => {
            document.documentElement.requestFullscreen?.().catch(() => undefined)
            setStarted(true)
          }}
        >
          <LacSeal size={140} className="lac-drop" label="Mohar" />
          <span className="tour-rec-title">{t("tour.recStart")}</span>
          <span className="muted small">{t("tour.recHint")}</span>
        </button>
      </div>
    )
  const rect = spot?.step === step ? spot.rect : undefined
  const progress = tick.step === step ? tick.value : 0

  return (
    <div className="tour" aria-live="polite">
      {s.end ? (
        <div className="tour-end">
          <LacSeal size={210} className="stamp-slam lac-drop" label="Mohar" />
          <p className="tour-end-line">{s[lang]}</p>
          <p className="tour-end-url">mohar.live</p>
          <div className="row-gap" hidden={rec}>
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
        <div className={`tour-bar ${rec ? "tour-bar-rec" : ""}`}>
          <div className="tour-progress" style={{ transform: `scaleX(${playing ? progress : 0})` }} />
          <p className="tour-text">{s[lang]}</p>
          <div className="tour-controls" hidden={rec}>
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
            <button className={`icon-btn lg ${voice ? "on" : ""}`} onClick={() => toggleVoice()} aria-label={t("tour.voice")} title={`${t("tour.voice")} (V)`}>
              {voice ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button className="icon-btn lg" onClick={toggleFullscreen} aria-label={t("tour.fullscreen")} title={`${t("tour.fullscreen")} (F)`}>
              <Maximize size={18} />
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
