import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import QRCode from "qrcode"
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type Address, type Hex, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { useExam } from "../hooks/useExam"
import { useT } from "../i18n"
import { ISSUERS, revealExam } from "../lib/mohar"
import type { SealSecrets } from "../lib/rules"
import { fmtDuration } from "./format"

// Presentation mode for the ETHIndia talk: the same 13 slides as the uploaded deck, drawn to the ETHIndia × Devcon
// template (its grid, colours, Geist and Silkscreen, lockups, stickers and footer), with the demo slide live.
//   ?stage=1&exam=ID        the talk. Next: → PageDown Space Enter (or a click). Back: ← PageUp. H Hindi, F fullscreen, S setup.
//   ?stage=remote&exam=ID   one big Reveal button, for revealing from a phone while the room watches their own phones.
//   &issuer=0x…             rehearse against an exam sealed by another wallet (defaults to the demo exam body)
//   &qr=https://…           what the closing QR opens (defaults to the Linktree; the QR before the demo is mohar.live/devcon)
// On the demo slide the first "next" sends the real reveal transaction; the image frame flips to the verdict read
// back from the chain. If nothing is on screen within a few seconds, the recorded backup plays instead.

const DEMO_ISSUER = Object.keys(ISSUERS)[0] as Address
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
    coverTitle: "Mohar: who had the paper first?",
    coverSub: "A clock for paper leaks that nobody controls.",
    role: "Builder, Mohar",
    s1: "The problem.",
    numLine: "exam leaks in 5 years, across 15 states",
    numSrc: "1.4 crore applicants hit · Indian Express, 2024",
    fightLabel: "01 / KEY POINT",
    fight: "Every leak is a fight about time.",
    fightBody: "A “leaked paper” goes round Telegram the night before the exam. Afterwards, nobody can prove when it existed. Screenshots get called fake, and the only other clock is the exam body’s own server, run by the party being accused.",
    s2: "What I built.",
    bigIdeaLabel: "THE BIG IDEA",
    bigIdea: "A clock for paper leaks that nobody controls.",
    howLabel: "HOW IT WORKS",
    how: "Seal, witness, verdict.",
    steps: [
      ["Seal", "Before the exam, the exam body seals a fingerprint of every question. Nobody can edit or delete it."],
      ["Witness", "Got a “leaked paper”? Seal its fingerprints from your phone. The text and your name never leave it."],
      ["Verdict", "At the bell the paper is revealed, and everyone sees who held real questions first."],
    ],
    arkivLabel: "02 / WHY ARKIV",
    arkiv: "The record lives on Arkiv, not on my server.",
    arkivBody: "Every seal, witness and reveal is a public record, timed by the network. Seals are read-only and their ownership is burned, so not even the exam body can delete one. Anyone can rebuild every verdict without my site.",
    s3: "Live demo.",
    scanNow: "Scan now. The paper opens in a minute.",
    demoLabel: "03 / LIVE DEMO",
    demo: "I leaked this talk’s paper. Watch it get caught.",
    demoBody: "Days ago I sealed a 5-question paper for this talk, then leaked 3 of its questions and sealed them from my phone. At the bell the paper is revealed, and the verdict comes straight from the public record.",
    sealedBy: "Sealed by",
    witnessN: (n: number) => (n === 1 ? "1 witness" : `${n} witnesses`),
    firstSealed: "first sealed {ago} ago",
    waiting: "Waiting for the paper",
    revealing: "Revealing the paper on Arkiv…",
    caught: "Held {n} real questions",
    caughtSub: "{t} before the exam",
    fake: "{n} fake",
    late: "{n} too late",
    noLeak: "No leak sealed yet",
    learnedLabel: "03 / WHAT I LEARNED",
    learned: "Evidence needs a clock nobody owns.",
    learnedBody: "What worked: trust comes from who signed a record on chain, not from a label or from me. What broke: a hidden ~128 KB transaction limit, and an “extend” call that sets a lifetime instead of adding to it. I filed 9 friction reports to Arkiv, each with a script that reproduces it.",
    nextLabel: "04 / WHAT’S NEXT",
    next: "Next: real exams, real exam bodies.",
    nextBody: "A pilot with a state PSC or a coaching network: exam bodies publish their wallet on their own .gov.in site and seal before the bell. Photo witnessing: snap a leaked paper and fingerprint it on the phone. Hindi and English throughout.",
    thanks: "Thank you!",
    revealPrompt: "Reveal the paper",
  },
  hi: {
    coverTitle: "मोहर: पेपर पहले किसके पास था?",
    coverSub: "पेपर लीक के लिए एक घड़ी, जिस पर किसी का क़ब्ज़ा नहीं।",
    role: "Builder, Mohar",
    s1: "समस्या।",
    numLine: "परीक्षा लीक, 5 साल में, 15 राज्यों में",
    numSrc: "1.4 करोड़ अभ्यर्थी प्रभावित · Indian Express, 2024",
    fightLabel: "01 / मुख्य बात",
    fight: "हर लीक की लड़ाई समय की है।",
    fightBody: "परीक्षा से पहली रात Telegram पर “लीक पेपर” घूमता है। बाद में कोई साबित नहीं कर पाता कि वह कब मौजूद था। स्क्रीनशॉट नकली कहे जाते हैं, और अकेली घड़ी परीक्षा संस्था का अपना सर्वर है, जिस पर ही आरोप है।",
    s2: "मैंने क्या बनाया।",
    bigIdeaLabel: "बड़ा विचार",
    bigIdea: "पेपर लीक के लिए एक घड़ी, जिस पर किसी का क़ब्ज़ा नहीं।",
    howLabel: "कैसे काम करता है",
    how: "मोहर, गवाही, फ़ैसला।",
    steps: [
      ["मोहर", "परीक्षा से पहले संस्था हर प्रश्न की फ़िंगरप्रिंट मोहर लगाती है। कोई उसे बदल या मिटा नहीं सकता।"],
      ["गवाही", "“लीक पेपर” मिला? फ़ोन से उसकी फ़िंगरप्रिंट मोहर लगाएँ। प्रश्न और आपका नाम फ़ोन से बाहर नहीं जाते।"],
      ["फ़ैसला", "परीक्षा शुरू होते ही पेपर खुलता है, और सब देखते हैं कि असली प्रश्न पहले किसके पास थे।"],
    ],
    arkivLabel: "02 / ARKIV क्यों",
    arkiv: "रिकॉर्ड Arkiv पर है, मेरे सर्वर पर नहीं।",
    arkivBody: "हर मोहर, गवाही और खुला पेपर एक सार्वजनिक रिकॉर्ड है, समय नेटवर्क का। मोहरें सिर्फ़ पढ़ी जा सकती हैं और उनका स्वामित्व जला दिया जाता है, इसलिए संस्था भी उन्हें मिटा नहीं सकती। कोई भी हर फ़ैसला मेरी साइट के बिना जाँच सकता है।",
    s3: "लाइव डेमो।",
    scanNow: "अभी स्कैन करें। पेपर एक मिनट में खुलेगा।",
    demoLabel: "03 / लाइव डेमो",
    demo: "मैंने इस टॉक का पेपर लीक किया। देखिए, कैसे पकड़ा गया।",
    demoBody: "कुछ दिन पहले मैंने इस टॉक के लिए 5 प्रश्नों के पेपर पर मोहर लगाई, फिर उसके 3 प्रश्न लीक करके फ़ोन से उनकी मोहर लगाई। अब पेपर खुलेगा, और फ़ैसला सीधे सार्वजनिक रिकॉर्ड से आएगा।",
    sealedBy: "मोहर",
    witnessN: (n: number) => `${n} गवाही`,
    firstSealed: "पहली मोहर {ago} पहले",
    waiting: "पेपर का इंतज़ार",
    revealing: "Arkiv पर पेपर खुल रहा है…",
    caught: "{n} असली प्रश्न पहले से थे",
    caughtSub: "परीक्षा से {t} पहले",
    fake: "{n} नकली",
    late: "{n} देर से",
    noLeak: "अभी कोई लीक नहीं",
    learnedLabel: "03 / मैंने क्या सीखा",
    learned: "सबूत को ऐसी घड़ी चाहिए जो किसी की न हो।",
    learnedBody: "क्या चला: भरोसा इस बात से आता है कि रिकॉर्ड पर किसने हस्ताक्षर किए, किसी लेबल या मुझसे नहीं। क्या टूटा: लगभग 128 KB की छिपी ट्रांज़ैक्शन सीमा, और एक “extend” जो उम्र जोड़ता नहीं, तय करता है। मैंने Arkiv को 9 रिपोर्ट भेजीं, हर एक के साथ दोहराने की स्क्रिप्ट।",
    nextLabel: "04 / आगे क्या",
    next: "आगे: असली परीक्षाएँ, असली परीक्षा संस्थाएँ।",
    nextBody: "किसी राज्य PSC या कोचिंग नेटवर्क के साथ पायलट: संस्थाएँ अपना वॉलेट अपनी .gov.in साइट पर प्रकाशित करें और परीक्षा से पहले मोहर लगाएँ। फ़ोटो से गवाही: लीक पेपर की फ़ोटो लें और फ़ोन पर ही फ़िंगरप्रिंट बनाएँ।",
    thanks: "धन्यवाद!",
    revealPrompt: "पेपर खोलें",
  },
}
type Copy = (typeof copy)["en"]

const SLIDES = ["cover", "problem", "number", "fight", "built", "idea", "how", "arkiv", "demoSection", "demo", "learned", "next", "thanks"] as const
const DEMO_AT = SLIDES.indexOf("demo")
// the room scans this before the reveal and watches the verdict land on their own phones
const DEMO_QR = "https://mohar.live/devcon"
const LINKTREE = "https://linktr.ee/vidit.choudhary"

// template geometry: a 13.333 × 7.5 inch slide drawn on a 1920 × 1080 canvas, so 1 inch = 144 px and 1 pt = 2 px
const IN = 144
const at = (x: number, y: number, w?: number, h?: number): CSSProperties => ({ left: x * IN, top: y * IN, width: w === undefined ? undefined : w * IN, height: h === undefined ? undefined : h * IN })
const Box = ({ x, y, w, h, className, children, style }: { x: number; y: number; w?: number; h?: number; className?: string; children?: ReactNode; style?: CSSProperties }) => (
  <div className={`tpl-box ${className ?? ""}`} style={{ ...at(x, y, w, h), ...style }}>
    {children}
  </div>
)
const Img = ({ src, x, y, w, h, alt = "" }: { src: string; x: number; y: number; w: number; h: number; alt?: string }) => <img className="tpl-box" src={`/stage/${src}.png`} alt={alt} style={at(x, y, w, h)} draggable={false} />

// the ETHIndia × Devcon lockup, top left on covers and dividers
const Lockup = ({ light }: { light?: boolean }) => (
  <>
    <Img src={light ? "ethindia-white" : "ethindia"} x={1.11} y={0.68} w={1.47} h={0.31} alt="ETHIndia" />
    <Box x={2.75} y={0.66} className={`tpl-x ${light ? "tpl-white" : ""}`}>
      ×
    </Box>
    <Img src={light ? "devcon-white" : "devcon"} x={3.04} y={0.56} w={1.27} h={0.56} alt="Devcon India" />
  </>
)
const Pill = ({ inverse }: { inverse?: boolean }) => (
  <Box x={8.89} y={0.56} w={3.33} h={0.56} className={`tpl-pill ${inverse ? "tpl-pill-inverse" : ""}`}>
    ETHIndia Stage · Devcon India
  </Box>
)
// the footer every content slide carries: small lockup on one side, "ETHINDIA STAGE @ DEVCON" on the other
const Footer = ({ logoX = 1.11, textX = 9.07, light }: { logoX?: number; textX?: number; light?: boolean }) => (
  <>
    <Img src={light ? "ethindia-white" : "ethindia"} x={logoX} y={6.84} w={1.01} h={0.21} />
    <Box x={logoX + 1.12} y={6.82} className={`tpl-x-sm ${light ? "tpl-white" : ""}`}>
      ×
    </Box>
    <Img src={light ? "devcon-white" : "devcon"} x={logoX + 1.31} y={6.78} w={0.76} h={0.33} />
    <Box x={textX} y={6.84} w={3.15} className={`tpl-pixel tpl-foot ${light ? "tpl-white" : ""}`}>
      ETHINDIA STAGE @ DEVCON
    </Box>
  </>
)

// a QR drawn on the slide itself, so it works offline and needs no image file
function useQr(url?: string) {
  const [qr, setQr] = useState("")
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 720, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then(setQr, () => setQr(""))
  }, [url])
  return qr
}

function Section({ n, title, tone, qr }: { n: string; title: string; tone: "green" | "sky" | "cream"; qr?: { url: string; caption: string } }) {
  const light = tone === "green"
  const code = useQr(qr?.url)
  return (
    <div className={`tpl-slide tpl-bg-${tone}`}>
      <Lockup light={light} />
      <Box x={1.11} y={2.62} w={11.44} className={`tpl-pixel tpl-label ${light ? "tpl-white" : "tpl-green"}`}>
        SECTION {n}
      </Box>
      <Box x={1.11} y={3.05} w={7.44} className={`tpl-title-xl ${light ? "tpl-white" : ""}`}>
        <h1>{title}</h1>
      </Box>
      <Box x={6.5} y={4.44} w={5.72} className={`tpl-pixel tpl-section-n ${tone === "green" ? "tpl-white" : tone === "sky" ? "" : "tpl-green"}`}>
        {n}
      </Box>
      {qr && code && (
        <>
          <img className="tpl-box tpl-qr" src={code} alt={`QR code for ${qr.url}`} style={at(9.2, 0.8, 3.0, 3.0)} />
          <Box x={5.2} y={3.95} w={7} className="tpl-role tpl-right">
            {qr.caption}
          </Box>
        </>
      )}
    </div>
  )
}

// a statement on a coloured panel, detail beside it on the grid
function KeyPoint({ label, title, body, tone, panelRight }: { label: string; title: string; body: string; tone: "green" | "cream" | "black"; panelRight?: boolean }) {
  const px = panelRight ? 7.78 : 0
  const tx = panelRight ? 8.33 : 1.11
  const light = tone !== "cream"
  return (
    <div className="tpl-slide tpl-bg-white">
      <div className={`tpl-box tpl-panel tpl-panel-${tone}`} style={at(px, 0, 5.56, 7.5)} />
      <Box x={tx} y={2.8} w={4.01} className={`tpl-pixel tpl-label-sm ${light ? "tpl-white" : "tpl-green"}`}>
        {label}
      </Box>
      <Box x={tx} y={3.17} w={4.01} className={`tpl-statement ${light ? "tpl-white" : ""}`}>
        <h1>{title}</h1>
      </Box>
      <Box x={panelRight ? 1.11 : 6.67} y={2.52} w={5.72} className="tpl-body">
        <p>{body}</p>
      </Box>
      <Footer logoX={panelRight ? 1.11 : 6.67} textX={panelRight ? 3.52 : 9.07} />
    </div>
  )
}

// fits the 1920 × 1080 template canvas into any screen, letterboxed, like a projector would
function useCanvasScale() {
  const [scale, setScale] = useState(() => Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])
  return scale
}

export function Stage({ examId, remote, issuer = DEMO_ISSUER, qr }: { examId: string; remote: boolean; issuer?: Address; qr?: string }) {
  const { lang, setLang } = useT()
  const c: Copy = copy[lang]
  const x = useExam(examId, issuer, [])
  const scale = useCanvasScale()
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
      // on the demo slide, the first "next" is the reveal itself; the slide stays while the verdict lands
      if (slide === DEMO_AT && to > slide && !shown && !backupVisible && reveal !== "failed") {
        if (reveal === "idle") void doReveal()
        return
      }
      setSlide(Math.max(0, Math.min(SLIDES.length - 1, to)))
    },
    [slide, shown, backupVisible, reveal, doReveal],
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
  const setupPanel = setup && <Setup {...{ examId, issuer, key_: key, setKey, setSavedRaw, saved, account, exam, setVideo, fallbackS, setFallbackS, close: () => setSetup(false), remote }} />

  if (remote)
    return (
      <div className="stage stage-remote tpl-fonts">
        <img src="/stage/ethindia.png" alt="ETHIndia" className="stage-remote-logo" />
        <h1>{exam?.title ?? examId}</h1>
        {shown ? (
          <LiveExam c={c} summary={summary} />
        ) : (
          <button className="stage-big" onClick={() => void doReveal()} disabled={reveal === "sending" || reveal === "sent"}>
            {reveal === "sending" || reveal === "sent" ? c.revealing : c.revealPrompt}
          </button>
        )}
        {revealError && <p className="stage-error">{revealError}</p>}
        <button className="stage-setup-link" onClick={() => setSetup(true)}>
          Setup
        </button>
        {setupPanel}
      </div>
    )

  const name = SLIDES[slide]
  const live = (
    <LiveExam
      c={c}
      summary={summary}
      shown={shown}
      state={reveal}
      error={revealError}
      exam={exam ? { title: exam.title, by: ISSUERS[issuer] ?? `${issuer.slice(0, 10)}…` } : undefined}
      witnesses={witnesses.length}
      firstAgo={firstWitnessMs ? fmtDuration(nowMs - firstWitnessMs) : undefined}
    />
  )
  return (
    <div className="stage tpl-fonts" onClick={(e) => !(e.target instanceof Element && e.target.closest("button, a, input, .stage-setup")) && go(slide + 1)}>
      <div className="tpl-canvas" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="stage-slide" key={name} data-slide={name}>
          {name === "cover" && (
            <div className="tpl-slide tpl-bg-white">
              <Lockup />
              <Pill />
              <Box x={1.11} y={1.67} w={7.44} className="tpl-pixel tpl-label tpl-green">
                ETHINDIA × DEVCON
              </Box>
              <Box x={1.11} y={2.1} w={7.44} className="tpl-title-xl">
                <h1>{c.coverTitle}</h1>
              </Box>
              <Box x={1.11} y={4.1} w={7.44} className="tpl-sub">
                <p>{c.coverSub}</p>
              </Box>
              <Box x={1.11} y={5.56} w={6.44} className="tpl-name">
                Vidit Choudhary
              </Box>
              <Box x={1.11} y={6.06} w={6.44} className="tpl-role">
                {c.role}
              </Box>
              <Img src="ikat" x={11.11} y={1.67} w={1.67} h={2.26} />
              <Img src="elephant" x={8.33} y={2.78} w={2.78} h={2.39} />
              <Img src="block" x={7.78} y={5.56} w={1.67} h={1.67} />
              <Img src="paisley" x={10} y={5} w={3.06} h={2.24} />
              <Img src="diamond" x={11.67} y={4.17} w={0.49} h={0.78} />
            </div>
          )}
          {name === "problem" && <Section n="01" title={c.s1} tone="green" />}
          {name === "number" && (
            <div className="tpl-slide tpl-bg-white">
              <Box x={0.94} y={2.36} w={11.44} className="tpl-pixel tpl-big-number">
                41
              </Box>
              <Box x={2.38} y={4.05} w={8.58} className="tpl-quote">
                <p>{c.numLine}</p>
              </Box>
              <Box x={3.81} y={4.61} w={5.72} className="tpl-source">
                <p>{c.numSrc}</p>
              </Box>
              <Footer />
            </div>
          )}
          {name === "fight" && <KeyPoint label={c.fightLabel} title={c.fight} body={c.fightBody} tone="green" />}
          {name === "built" && <Section n="02" title={c.s2} tone="sky" />}
          {name === "idea" && (
            <div className="tpl-slide tpl-bg-white">
              <Box x={3.81} y={2.6} w={5.72} className="tpl-pixel tpl-label tpl-green tpl-center">
                {c.bigIdeaLabel}
              </Box>
              <Box x={1.52} y={3.09} w={10.3} className="tpl-big-idea">
                <h1>{c.bigIdea}</h1>
              </Box>
              <Img src="diamond" x={11.67} y={0.56} w={0.56} h={0.9} />
              <Footer />
            </div>
          )}
          {name === "how" && (
            <div className="tpl-slide tpl-bg-white">
              <Box x={1.11} y={1.11} w={11.44} className="tpl-pixel tpl-label-sm tpl-green">
                {c.howLabel}
              </Box>
              <Box x={1.11} y={1.53} w={11.44} className="tpl-title-md">
                <h1>{c.how}</h1>
              </Box>
              {c.steps.map(([t, d], i) => (
                <div key={t}>
                  <div className="tpl-box tpl-rule" style={at(1.11 + i * 3.89, 3.29, 3.33)} />
                  <Box x={1.11 + i * 3.89} y={3.53} w={3.43} className="tpl-pixel tpl-step-n tpl-green">
                    0{i + 1}
                  </Box>
                  <Box x={1.11 + i * 3.89} y={3.88} w={3.43} className="tpl-step-t">
                    <h2>{t}</h2>
                  </Box>
                  <Box x={1.11 + i * 3.89} y={4.36} w={3.43} className="tpl-step-d">
                    <p>{d}</p>
                  </Box>
                </div>
              ))}
              <Footer />
            </div>
          )}
          {name === "arkiv" && (
            <div className="tpl-slide tpl-bg-white">
              <div className="tpl-box tpl-frame" style={at(1.12, 1.12, 4.99, 4.99)}>
                <img src="/stage/exam.png" alt="The demo exam on mohar.live: leak evidence, seals and timeline" />
              </div>
              <Box x={6.67} y={2.3} w={5.72} className="tpl-pixel tpl-label-sm tpl-green">
                {c.arkivLabel}
              </Box>
              <Box x={6.67} y={2.72} w={5.72} className="tpl-title-sm">
                <h1>{c.arkiv}</h1>
              </Box>
              <Box x={6.67} y={3.84} w={5.72} className="tpl-body-sm">
                <p>{c.arkivBody}</p>
              </Box>
              <Footer />
            </div>
          )}
          {name === "demoSection" && <Section n="03" title={c.s3} tone="cream" qr={{ url: DEMO_QR, caption: c.scanNow }} />}
          {name === "demo" && (
            <div className="tpl-slide tpl-bg-white">
              <Box x={1.11} y={2.3} w={5.72} className="tpl-pixel tpl-label-sm tpl-green">
                {c.demoLabel}
              </Box>
              <Box x={1.11} y={2.72} w={5.72} className="tpl-title-sm">
                <h1>{c.demo}</h1>
              </Box>
              <Box x={1.11} y={3.84} w={5.72} className="tpl-body-sm">
                <p>{c.demoBody}</p>
              </Box>
              <div className="tpl-box tpl-frame tpl-live" style={at(7.23, 1.12, 4.99, 4.99)}>
                {live}
              </div>
              <Footer />
            </div>
          )}
          {name === "learned" && <KeyPoint label={c.learnedLabel} title={c.learned} body={c.learnedBody} tone="cream" />}
          {name === "next" && <KeyPoint label={c.nextLabel} title={c.next} body={c.nextBody} tone="black" panelRight />}
          {name === "thanks" && <Thanks c={c} url={qr ?? LINKTREE} />}
        </div>
      </div>
      {backupVisible && video && (
        <div className="stage-backup">
          <video src={video} autoPlay controls={false} onEnded={() => setShowBackup(false)} />
        </div>
      )}
      {setupPanel}
    </div>
  )
}

type Summary = { top?: { matches: unknown[]; witnessedAtMs: number; deadlineMs: number }; fake: number; late: number }

// the demo slide's image frame, live: the sealed exam while it waits, then the verdict read back from the chain
function LiveExam({ c, summary, shown = true, state, error, exam, witnesses, firstAgo }: { c: Copy; summary: Summary; shown?: boolean; state?: Reveal; error?: string; exam?: { title: string; by: string }; witnesses?: number; firstAgo?: string }) {
  if (shown) {
    const top = summary.top
    return (
      <div className="tpl-verdict">
        <div className="stage-stamp">LEAK</div>
        {top ? (
          <>
            <h1 className="tpl-verdict-big">{c.caught.replace("{n}", String(top.matches.length))}</h1>
            <p className="tpl-verdict-when">{c.caughtSub.replace("{t}", fmtDuration(top.deadlineMs - top.witnessedAtMs))}</p>
          </>
        ) : (
          <h1 className="tpl-verdict-big">{c.noLeak}</h1>
        )}
        <p className="tpl-verdict-counts">
          {[summary.fake > 0 && c.fake.replace("{n}", String(summary.fake)), summary.late > 0 && c.late.replace("{n}", String(summary.late))].filter(Boolean).join(" · ")}
        </p>
      </div>
    )
  }
  return (
    <div className="tpl-waiting">
      <p className="tpl-pixel tpl-label-sm tpl-green">{exam ? `${c.sealedBy} ${exam.by} ✓` : "…"}</p>
      <h2>{exam?.title ?? "…"}</h2>
      <p>
        {c.witnessN(witnesses ?? 0)}
        {firstAgo ? ` · ${c.firstSealed.replace("{ago}", firstAgo)}` : ""}
      </p>
      <p className="tpl-waiting-state">{state === "sending" || state === "sent" ? c.revealing : state === "failed" ? error : c.waiting}</p>
    </div>
  )
}

function Thanks({ c, url }: { c: Copy; url: string }) {
  const qr = useQr(url)
  return (
    <div className="tpl-slide tpl-bg-green">
      <Lockup light />
      <Pill inverse />
      <Box x={1.11} y={1.67} w={7.44} className="tpl-thanks tpl-white">
        <h1>{c.thanks}</h1>
      </Box>
      <Box x={1.11} y={4.84} w={6.44} className="tpl-name tpl-white">
        Vidit Choudhary
      </Box>
      <Box x={1.11} y={5.34} w={6.44} className="tpl-role tpl-white">
        {c.role}
      </Box>
      <Box x={1.11} y={5.72} w={6.44} className="tpl-role tpl-white">
        mohar.live
      </Box>
      <Box x={1.11} y={6.1} w={6.44} className="tpl-pixel tpl-label tpl-white">
        github.com/vidit-16/mohar
      </Box>
      {qr && <img className="tpl-box tpl-qr" src={qr} alt={`QR code for ${url}`} style={at(7.55, 1.9, 3.1, 3.1)} />}
      <Box x={7.55} y={5.12} w={3.1} className="tpl-pixel tpl-label tpl-white tpl-center">
        {url.replace(/^https?:\/\/(www\.)?/, "")}
      </Box>
      <Img src="leaf" x={11.11} y={1.67} w={1.67} h={1.99} />
      <Img src="paisley" x={10} y={5} w={3.06} h={2.24} />
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
