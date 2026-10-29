// Shared by api/card.ts and api/share.ts: what a link preview says about one witness.
// The verdict comes from verify/verify.mjs, the zero-dependency reader that's parity-tested against the app,
// so a shared card can't disagree with the page it opens.

export type Tone = "danger" | "good" | "warn" | "info"
export type Card = { exam: string; headline: string; detail: string; tone: Tone; badge: string }
type Witness = { key: string; at: number; before: boolean; total: number; hits: string[]; verdict: "late" | "waiting" | "leak" | "no-match" }
type Verdicts = { kind: "sealed" | "open" | "none"; title?: string; deadline?: number; witnesses?: Witness[] }

export const FALLBACK: Card = { exam: "Mohar", tone: "info", badge: "MOHAR", headline: "Prove who had the paper before the exam", detail: "Tamper-proof records for exam paper leaks, readable by anyone." }

// same wording as the exam page's fmtDuration ("2m before the exam"); a test keeps the two identical
export function fmtDuration(ms: number): string {
  const abs = Math.abs(ms)
  if (abs < 60_000) return `${Math.max(1, Math.round(abs / 1000))}s`
  const DAY = 86_400_000
  const d = Math.floor(abs / DAY)
  const h = Math.floor((abs % DAY) / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

// Card text is drawn by Satori, whose SVG escaping is broken before 0.33.5 (GHSA-wx4j-mvgx-mqwp), and the fixed
// @vercel/og 1.0.3 can't load in Node functions. Exam titles come from the chain, where anyone can write, so markup
// characters are swapped for look-alikes and control characters dropped before anything reaches the renderer.
export const plain = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/&/g, "and")
    .replace(/</g, "‹")
    .replace(/>/g, "›")
    .replace(/"/g, "”")
    .replace(/'/g, "’")
    .slice(0, 200)

export function cardFor(v: Verdicts, witnessKey: string): Card {
  const w = v.witnesses?.find((x) => x.key.toLowerCase() === witnessKey.toLowerCase())
  if (v.kind === "none" || !w || v.deadline === undefined) return FALLBACK
  const exam = v.title ?? "Mohar"
  const when = `${fmtDuration(v.deadline - w.at)} ${w.before ? "before" : "after"} the exam`
  if (w.verdict === "late") return { exam, tone: "warn", badge: "TOO LATE", headline: "Sealed after the exam started", detail: `Recorded ${when}, so it can't show anyone had the paper early.` }
  if (w.verdict === "waiting")
    return {
      exam,
      tone: "info",
      badge: "SEALED",
      headline: "Sealed before the exam",
      detail: v.kind === "open" ? `Recorded ${when}. Check it against the official paper once it's out.` : `Recorded ${when}. It's checked automatically when the paper is revealed.`,
    }
  if (w.verdict === "leak") {
    const n = w.hits.length
    return { exam, tone: "danger", badge: "LEAK", headline: `Held ${n} real question${n === 1 ? "" : "s"} before the exam`, detail: `Recorded ${when}. ${n} of ${w.total} fingerprints match the official paper, on a public record nobody can edit.` }
  }
  return { exam, tone: "good", badge: "NO MATCH", headline: "Not the real paper", detail: `Recorded ${when}, but none of it is on the official paper. This rumour was fake.` }
}

export async function loadCard(examId: string, witnessKey: string): Promise<Card> {
  if (!examId || examId.length > 120 || !/^0x[0-9a-fA-F]{64}$/.test(witnessKey)) return FALLBACK
  try {
    // the verifier reads ARKIV_RPC when it loads; point it at the keyed endpoint so previews don't
    // spend the keyless budget (~100 queries per IP, shared by every Vercel function)
    if (!process.env.ARKIV_RPC && process.env.ARKIV_KEY) process.env.ARKIV_RPC = `https://rpc.tiramisu.db-chain.testnet.arkiv.network/${process.env.ARKIV_KEY.trim()}`
    // @ts-expect-error plain JS on purpose, it has to run with zero dependencies
    const { verdicts } = await import("../verify/verify.mjs")
    return cardFor((await verdicts(examId)) as Verdicts, witnessKey)
  } catch {
    return FALLBACK
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export type Meta = { title: string; description: string; image: string; url: string }
export const cardMeta = (card: Card, image: string, url: string): Meta => ({
  title: card === FALLBACK ? "Mohar · Prove who had the paper before the exam" : `${card.badge === "LEAK" ? "Leak: " : ""}${card.headline} · ${card.exam}`,
  description: card.detail,
  image,
  url,
})

// Swaps the page's default title and preview tags for this witness's; everything else stays byte-for-byte.
export function injectMeta(html: string, m: Meta): string {
  const set = (attr: "property" | "name", key: string, value: string) => {
    const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`
    const re = new RegExp(`<meta ${attr}="${key}" content="[^"]*"\\s*/?>`)
    return (h: string) => (re.test(h) ? h.replace(re, () => tag) : h.replace("</head>", () => `    ${tag}\n  </head>`))
  }
  const steps = [
    (h: string) => h.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(m.title)}</title>`),
    set("name", "description", m.description),
    set("property", "og:title", m.title),
    set("property", "og:description", m.description),
    set("property", "og:image", m.image),
    set("property", "og:url", m.url),
    set("name", "twitter:title", m.title),
    set("name", "twitter:description", m.description),
    set("name", "twitter:image", m.image),
  ]
  return steps.reduce((h, f) => f(h), html)
}
