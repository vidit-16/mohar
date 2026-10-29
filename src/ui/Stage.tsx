import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import QRCode from "qrcode"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type Address, type Hex, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { useExam } from "../hooks/useExam"
import { useT } from "../i18n"
import { ISSUERS, revealExam } from "../lib/mohar"
import type { SealSecrets } from "../lib/rules"
import { Emblem } from "./brand"
import { fmtDateTime, fmtDuration } from "./format"

// Presentation mode for a live talk: the slides and the live exam in one fullscreen page, driven by a clicker.
//   ?stage=1&exam=ID        the talk. Next: → PageDown Space Enter (or a click). Back: ← PageUp. H Hindi, F fullscreen, S setup.
//   ?stage=remote&exam=ID   one big Reveal button, for revealing from a phone while the room watches their own phones.
//   &issuer=0x…             rehearse against an exam sealed by another wallet (defaults to the demo exam body)
//   &qr=https://…           what the closing QR opens; a short link scans better from the back of a hall
// The reveal slide sends the real reveal transaction. If nothing is on screen within a few seconds, the recorded
// backup plays instead, so a slow network never leaves the presenter standing in silence.

export const DEMO_ISSUER = Object.keys(ISSUERS)[0] as Address
const KEY_STORE = "mohar.stage.key"
const SALTS_STORE = "mohar.stage.salts"
type Saved = SealSecrets & { opensAtMs: number }

const read = (k: string) => {
  try {
    return localStorage.getItem(k) ?? ""
  } catch {
    return ""
  }
}
const write = (k: string, v: string) => {
  try {
    if (v) localStorage.setItem(k, v)
    else localStorage.removeItem(k)
  } catch {
    /* private window: setup lasts for this tab only */
  }
}
const parseSaved = (raw: string): Saved | undefined => {
  try {
    const s = JSON.parse(raw) as Saved
    return s.examId && Array.isArray(s.sets) && s.opensAtMs ? s : undefined
  } catch {
    return undefined
  }
}

type Reveal = "idle" | "sending" | "sent" | "failed"

const copy = {
  en: {
    title: "Prove who had the paper before the exam.",
    hook: "NEET-UG 2026 was cancelled.",
    hookSub: "The 3 May exam was re-held on 21 June. The leak came from inside the exam body.",
    fight: "Every leak is a fight about time.",
    leaks: "recruitment exam leaks in 5 years",
    states: "states",
    applicants: "applicants affected (14 million)",
    idea: "A clock nobody controls.",
    beats: [
      "Before the exam, the exam body seals a fingerprint of every question. Nobody can edit or delete it.",
      "Anyone who gets a “leaked paper” seals its fingerprints from their phone. The text and their name never leave it.",
      "At the bell the paper is revealed, and everyone sees who had real questions first.",
    ],
    onArkiv: "Every record lives on Arkiv: public, time-stamped by the network, readable without this website.",
    leaked: "Someone leaked the paper for this talk.",
    sealedAgo: "Sealed {ago} ago",
    noWitness: "No leak sealed yet",
    waiting: "Sealed, waiting for the paper",
    by: "Sealed by",
    witnesses: "witnesses",
    witness: "witness",
    opens: "Announced start",
    revealPrompt: "Reveal the paper",
    revealing: "Revealing the paper on Arkiv…",
    caught: "Held {n} real questions",
    caughtSub: "{t} before the exam. On a public record nobody can edit.",
    fake: "{n} fake",
    late: "{n} too late",
    learned: "What I learned",
    lessons: [
      "Evidence is only as good as the clock behind it.",
      "Building on Arkiv: 9 friction reports filed upstream, each with a script that reproduces it.",
      "Anyone can rebuild every verdict without my site: npx mohar-verify.",
    ],
    scan: "Check it yourself",
    scanSub: "Every verdict you just saw is on a public record.",
  },
  hi: {
    title: "परीक्षा से पहले पेपर किसके पास था, साबित करें।",
    hook: "NEET-UG 2026 रद्द हुआ।",
    hookSub: "3 मई की परीक्षा 21 जून को दोबारा हुई। लीक परीक्षा संस्था के अंदर से हुआ।",
    fight: "हर लीक की लड़ाई समय की है।",
    leaks: "भर्ती परीक्षा लीक, 5 साल में",
    states: "राज्य",
    applicants: "अभ्यर्थी प्रभावित",
    idea: "एक घड़ी जिस पर किसी का क़ब्ज़ा नहीं।",
    beats: [
      "परीक्षा से पहले, परीक्षा संस्था हर प्रश्न की फ़िंगरप्रिंट मोहर लगाती है। कोई उसे बदल या मिटा नहीं सकता।",
      "जिसके पास “लीक पेपर” आए, वह फ़ोन से उसकी फ़िंगरप्रिंट मोहर लगाए। प्रश्न और नाम फ़ोन से बाहर नहीं जाते।",
      "परीक्षा शुरू होते ही पेपर खुलता है, और सब देखते हैं कि असली प्रश्न पहले किसके पास थे।",
    ],
    onArkiv: "हर रिकॉर्ड Arkiv पर है: सार्वजनिक, नेटवर्क का समय, इस वेबसाइट के बिना भी पढ़ा जा सके।",
    leaked: "इस टॉक का पेपर किसी ने लीक किया।",
    sealedAgo: "{ago} पहले मोहर लगी",
    noWitness: "अभी कोई लीक नहीं",
    waiting: "मोहर लगी है, पेपर का इंतज़ार",
    by: "मोहर",
    witnesses: "गवाहियाँ",
    witness: "गवाही",
    opens: "घोषित समय",
    revealPrompt: "पेपर खोलें",
    revealing: "Arkiv पर पेपर खुल रहा है…",
    caught: "{n} असली प्रश्न पहले से थे",
    caughtSub: "परीक्षा से {t} पहले। ऐसे सार्वजनिक रिकॉर्ड पर जिसे कोई बदल नहीं सकता।",
    fake: "{n} नकली",
    late: "{n} देर से",
    learned: "मैंने क्या सीखा",
    lessons: ["सबूत उतना ही अच्छा है जितनी उसके पीछे की घड़ी।", "Arkiv पर बनाते हुए: 9 समस्याएँ रिपोर्ट कीं, हर एक के साथ दोहराने की स्क्रिप्ट।", "कोई भी हर फ़ैसला मेरी साइट के बिना जाँच सकता है: npx mohar-verify।"],
    scan: "खुद जाँचें",
    scanSub: "जो फ़ैसले आपने अभी देखे, सब सार्वजनिक रिकॉर्ड पर हैं।",
  },
} as const

const SLIDES = ["title", "hook", "fight", "idea", "leak", "exam", "reveal", "learned", "scan"] as const
const REVEAL_AT = SLIDES.indexOf("reveal")

export function Stage({ examId, remote, issuer = DEMO_ISSUER, qr }: { examId: string; remote: boolean; issuer?: Address; qr?: string }) {
  const { lang, setLang } = useT()
  const c = copy[lang]
  const x = useExam(examId, issuer, [])
  const [slide, setSlide] = useState(0)
  const [setup, setSetup] = useState(false)
  const [key, setKey] = useState(() => read(KEY_STORE))
  const [savedRaw, setSavedRaw] = useState(() => read(SALTS_STORE))
  const [video, setVideo] = useState<string>()
  const [fallbackS, setFallbackS] = useState(8)
  const [reveal, setReveal] = useState<Reveal>("idle")
  const [revealError, setRevealError] = useState<string>()
  const [showBackup, setShowBackup] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const backupTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const saved = useMemo(() => parseSaved(savedRaw), [savedRaw])
  const account = useMemo(() => (/^0x[0-9a-fA-F]{64}$/.test(key.trim()) ? privateKeyToAccount(key.trim() as Hex) : undefined), [key])

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // the strongest leak decides the headline; everything else is a count
  const summary = useMemo(() => {
    const vs = [...x.verdicts.values()]
    const leaks = vs.filter((v) => v.before && v.matches.length > 0).sort((a, b) => b.matches.length - a.matches.length)
    return {
      top: leaks[0],
      fake: vs.filter((v) => v.before && v.matches.length === 0).length,
      late: vs.filter((v) => !v.before).length,
    }
  }, [x.verdicts])
  const revealed = x.reveals.length > 0
  const shown = revealed && x.verdicts.size > 0

  // once the real verdict is on screen the backup has no job left, even if its timer fires later
  const backupVisible = showBackup && !shown

  const doReveal = useCallback(async () => {
    if (revealed || reveal === "sending" || reveal === "sent") return
    if (!account || !saved || saved.examId !== examId) {
      setRevealError("Not set up: press S")
      setReveal("failed")
      return
    }
    setReveal("sending")
    setRevealError(undefined)
    clearTimeout(backupTimer.current)
    backupTimer.current = setTimeout(() => setShowBackup(Boolean(video)), fallbackS * 1000)
    try {
      const wallet = createWalletClient({ chain: tiramisu, transport: http(undefined, { retryCount: 1 }), account })
      await revealExam(wallet, saved, saved.opensAtMs)
      setReveal("sent")
      x.reload()
    } catch (e) {
      setReveal("failed")
      setRevealError(e instanceof Error ? e.message.split("\n")[0] : String(e))
    }
  }, [revealed, reveal, account, saved, examId, video, fallbackS, x])

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(SLIDES.length - 1, to))
      // arriving on the reveal slide is the click that reveals
      if (next === REVEAL_AT && slide === REVEAL_AT - 1) void doReveal()
      setSlide(next)
    },
    [slide, doReveal],
  )

  useEffect(() => {
    if (remote) return
    const onKey = (e: KeyboardEvent) => {
      // clickers and some keyboards send keys to the document itself, which isn't an element
      if (setup || (e.target instanceof Element && e.target.closest("input, textarea"))) return
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) go(slide + 1)
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) go(slide - 1)
      else if (e.key === "h" || e.key === "H") setLang(lang === "en" ? "hi" : "en")
      else if (e.key === "f" || e.key === "F") void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)
      else if (e.key === "s" || e.key === "S") setSetup(true)
      else if (e.key === "b" || e.key === "B") setShowBackup((v) => Boolean(video) && !v)
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [remote, setup, slide, go, lang, setLang, video])

  const exam = x.exam
  const witnesses = x.witnesses
  const firstWitnessMs = witnesses.map((w) => x.times.get(w.createdAt)).filter((t): t is number => t !== undefined).sort((a, b) => a - b)[0]

  if (remote)
    return (
      <div className="stage stage-remote">
        <Emblem size={96} />
        <h1>{exam?.title ?? examId}</h1>
        {shown ? (
          <Verdict c={c} summary={summary} />
        ) : (
          <button className="stage-big" onClick={() => void doReveal()} disabled={reveal === "sending" || reveal === "sent"}>
            {reveal === "sending" || reveal === "sent" ? c.revealing : c.revealPrompt}
          </button>
        )}
        {revealError && <p className="stage-error">{revealError}</p>}
        <button className="stage-setup-link" onClick={() => setSetup(true)}>
          Setup
        </button>
        {setup && <Setup {...{ examId, issuer, key_: key, setKey, setSavedRaw, saved, account, exam, setVideo, fallbackS, setFallbackS, close: () => setSetup(false), remote }} />}
      </div>
    )

  const name = SLIDES[slide]
  return (
    <div className="stage" onClick={(e) => !(e.target instanceof Element && e.target.closest("button, a, input, .stage-setup")) && go(slide + 1)}>
      <div className="stage-slide" key={name} data-slide={name}>
        {name === "title" && (
          <div className="stage-center">
            <Emblem size={220} />
            <h1 className="stage-xl">Mohar</h1>
            <p className="stage-lead">{c.title}</p>
            <p className="stage-small">Vidit Choudhary · mohar.live</p>
          </div>
        )}
        {name === "hook" && (
          <div className="stage-col">
            <h1 className="stage-xl">{c.hook}</h1>
            <p className="stage-lead">{c.hookSub}</p>
          </div>
        )}
        {name === "fight" && (
          <div className="stage-col">
            <h1 className="stage-xl">{c.fight}</h1>
            <div className="stage-stats">
              <div>
                <b>41</b>
                <span>{c.leaks}</span>
              </div>
              <div>
                <b>15</b>
                <span>{c.states}</span>
              </div>
              <div>
                <b>1.4 cr</b>
                <span>{c.applicants}</span>
              </div>
            </div>
          </div>
        )}
        {name === "idea" && (
          <div className="stage-split">
            <div>
              <h1 className="stage-xl">{c.idea}</h1>
              <p className="stage-small">{c.onArkiv}</p>
            </div>
            <ol className="stage-beats">
              {c.beats.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ol>
          </div>
        )}
        {name === "leak" && (
          <div className="stage-split">
            <div>
              <h1 className="stage-xl">{c.leaked}</h1>
              {firstWitnessMs ? (
                <p className="stage-lead">
                  {c.sealedAgo.replace("{ago}", fmtDuration(nowMs - firstWitnessMs))}
                  <br />
                  <span className="stage-small">{fmtDateTime(firstWitnessMs)}</span>
                </p>
              ) : (
                <p className="stage-lead">{c.noWitness}</p>
              )}
            </div>
            <img className="stage-shot" src="/stage/leak.png" alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
          </div>
        )}
        {name === "exam" && (
          <div className="stage-col">
            <p className="stage-small">{exam ? `${c.by} ${ISSUERS[issuer] ?? `${issuer.slice(0, 10)}…`} ✓` : examId}</p>
            <h1 className="stage-xl">{exam?.title ?? examId}</h1>
            <div className="stage-stats">
              <div>
                <b>{witnesses.length}</b>
                <span>{witnesses.length === 1 ? c.witness : c.witnesses}</span>
              </div>
              <div>
                <b>{revealed ? "✓" : "—"}</b>
                <span>{revealed ? "" : c.waiting}</span>
              </div>
              <div>
                <b className="stage-time">{exam ? fmtDateTime(exam.opensAtMs) : "…"}</b>
                <span>{c.opens}</span>
              </div>
            </div>
          </div>
        )}
        {name === "reveal" && (
          <div className="stage-center">
            {shown ? (
              <Verdict c={c} summary={summary} />
            ) : (
              <>
                <Emblem size={180} animate />
                <p className="stage-lead">{reveal === "failed" ? revealError : c.revealing}</p>
              </>
            )}
          </div>
        )}
        {name === "learned" && (
          <div className="stage-col">
            <h1 className="stage-xl">{c.learned}</h1>
            <ul className="stage-beats">
              {c.lessons.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
        {name === "scan" && <Scan c={c} url={qr ?? `${location.origin}/?exam=${encodeURIComponent(examId)}`} />}
      </div>
      <div className="stage-progress" aria-hidden>
        <span style={{ width: `${((slide + 1) / SLIDES.length) * 100}%` }} />
      </div>
      {backupVisible && video && (
        <div className="stage-backup">
          <video src={video} autoPlay controls={false} onEnded={() => setShowBackup(false)} />
        </div>
      )}
      {setup && <Setup {...{ examId, issuer, key_: key, setKey, setSavedRaw, saved, account, exam, setVideo, fallbackS, setFallbackS, close: () => setSetup(false), remote }} />}
    </div>
  )
}

function Verdict({ c, summary }: { c: (typeof copy)["en" | "hi"]; summary: { top?: { matches: unknown[]; witnessedAtMs: number; deadlineMs: number }; fake: number; late: number } }) {
  const top = summary.top
  return (
    <div className="stage-verdict">
      <div className="stage-stamp">LEAK</div>
      {top ? (
        <>
          <h1 className="stage-xl">{c.caught.replace("{n}", String(top.matches.length))}</h1>
          <p className="stage-lead">{c.caughtSub.replace("{t}", fmtDuration(top.deadlineMs - top.witnessedAtMs))}</p>
        </>
      ) : (
        <h1 className="stage-xl">{c.noWitness}</h1>
      )}
      <p className="stage-small">
        {summary.fake > 0 && c.fake.replace("{n}", String(summary.fake))}
        {summary.fake > 0 && summary.late > 0 && " · "}
        {summary.late > 0 && c.late.replace("{n}", String(summary.late))}
      </p>
    </div>
  )
}

function Scan({ c, url }: { c: (typeof copy)["en" | "hi"]; url: string }) {
  const [qr, setQr] = useState("")
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 640, errorCorrectionLevel: "M", color: { dark: "#0f0e0c", light: "#ffffff" } }).then(setQr, () => setQr(""))
  }, [url])
  return (
    <div className="stage-split">
      <div className="stage-col">
        <h1 className="stage-xl">{c.scan}</h1>
        <p className="stage-lead">{c.scanSub}</p>
        <p className="stage-url">mohar.live</p>
        <p className="stage-small">Vidit Choudhary · github.com/vidit-16/mohar</p>
      </div>
      {qr && <img className="stage-qr" src={qr} width={640} height={640} alt={`QR code for ${url}`} />}
    </div>
  )
}

type SetupProps = {
  examId: string
  issuer: Address
  key_: string
  setKey: (k: string) => void
  setSavedRaw: (s: string) => void
  saved?: Saved
  account?: { address: Address }
  exam: ReturnType<typeof useExam>["exam"]
  setVideo: (u: string | undefined) => void
  fallbackS: number
  setFallbackS: (n: number) => void
  close: () => void
  remote: boolean
}

function Setup({ examId, issuer, key_, setKey, setSavedRaw, saved, account, exam, setVideo, fallbackS, setFallbackS, close, remote }: SetupProps) {
  const checks: [string, boolean][] = [
    ["Exam found on Arkiv", Boolean(exam)],
    [`Signing key is the exam's issuer (${issuer.slice(0, 8)}…)`, account?.address.toLowerCase() === issuer.toLowerCase()],
    ["Salts file is for this exam", saved?.examId === examId],
  ]
  return (
    <div className="stage-setup" role="dialog" aria-label="Stage setup">
      <h2>Stage setup</h2>
      <p className="stage-note">Stored only in this browser. Testnet key only; never put a real exam body's key here.</p>
      <label>
        Issuer private key
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key_}
          onChange={(e) => {
            setKey(e.target.value)
            write(KEY_STORE, e.target.value.trim())
          }}
        />
      </label>
      <label>
        Salts file (secrets/{examId}.json)
        <input
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const text = await e.target.files?.[0]?.text()
            if (!text) return
            setSavedRaw(text)
            write(SALTS_STORE, text)
          }}
        />
      </label>
      {!remote && (
        <>
          <label>
            Backup video of the reveal (kept in memory, pick it again after a reload)
            <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : undefined)} />
          </label>
          <label>
            Play the backup if nothing shows after (seconds)
            <input type="number" min={3} max={30} value={fallbackS} onChange={(e) => setFallbackS(Math.max(3, Math.min(30, Number(e.target.value) || 8)))} />
          </label>
        </>
      )}
      <ul className="stage-checks">
        {checks.map(([label, ok]) => (
          <li key={label} className={ok ? "ok" : "bad"}>
            {ok ? "✓" : "✗"} {label}
          </li>
        ))}
      </ul>
      <div className="stage-setup-actions">
        <button
          onClick={() => {
            setKey("")
            setSavedRaw("")
            write(KEY_STORE, "")
            write(SALTS_STORE, "")
          }}
        >
          Forget key and salts
        </button>
        <button onClick={close}>Done</button>
      </div>
      {!remote && <p className="stage-note">Keys: → / PageDown / Space next · ← back · H Hindi · F fullscreen · B backup video · S setup</p>}
    </div>
  )
}
