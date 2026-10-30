// The image a chat app shows when someone shares a witness link: the verdict, read live from Arkiv.
//   GET /api/card?exam=<exam id>&w=<witness key>   → 1200×630 PNG
import { readFileSync } from "node:fs"
import { ImageResponse } from "@vercel/og"
import { CLOCK_SMALL, scallopPath } from "../src/ui/geometry.js"
import { type Card, FALLBACK, loadCard, plain, type Tone } from "./_share.js"

// the renderer's built-in font has no bold, so the card brings the site's own faces
const font = (file: string) => readFileSync(new URL(`./fonts/${file}`, import.meta.url))
const FONTS = [
  { name: "Inter", data: font("inter-400.ttf"), weight: 400 as const, style: "normal" as const },
  { name: "Inter", data: font("inter-800.ttf"), weight: 800 as const, style: "normal" as const },
  { name: "Fraunces", data: font("fraunces-600.ttf"), weight: 600 as const, style: "normal" as const },
]
// the seal, drawn from the app's own geometry and embedded, so the card never depends on fetching anything
const SEAL = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 70 70"><path d="${scallopPath(32, 32, 30, 14)}" fill="#a8291c"/><g transform="translate(32 32) scale(0.656)" fill="none" stroke="#fbe9df" stroke-width="7" stroke-linecap="round">${CLOCK_SMALL.map((d) => `<path d="${d}"/>`).join("")}</g></svg>`,
).toString("base64")}`

const TONES: Record<Tone, { fg: string; bg: string }> = {
  danger: { fg: "#b42318", bg: "#fde8e6" },
  good: { fg: "#16794a", bg: "#e3f4ea" },
  warn: { fg: "#a45a06", bg: "#fbefdc" },
  info: { fg: "#2f5fb3", bg: "#e5edfb" },
}

type Node = { type: string; props: Record<string, unknown> }
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } })

// The card a chat app shows: the verdict as a rubber stamp, so it reads before anyone opens the link.
function render(card: Card, generic: boolean) {
  const tone = TONES[card.tone]
  return h("div", { width: "100%", height: "100%", display: "flex", background: "#f7f5f0", padding: "60px 72px", fontFamily: "Inter", color: "#1d1a16" }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: 690 }, [
      h("div", { display: "flex", alignItems: "center", gap: 18 }, [
        { type: "img", props: { src: SEAL, width: 64, height: 64 } },
        h("div", { display: "flex", flexDirection: "column" }, [
          h("div", { fontSize: 28, fontWeight: 800, letterSpacing: 4 }, "MOHAR"),
          ...(generic ? [] : [h("div", { fontSize: 24, color: "#6b645a", maxWidth: 600 }, card.exam)]),
        ]),
      ]),
      h("div", { display: "flex", flexDirection: "column", gap: 20 }, [
        h("div", { fontFamily: "Fraunces", fontSize: 62, fontWeight: 600, lineHeight: 1.06, letterSpacing: -1 }, card.headline),
        h("div", { fontSize: 30, lineHeight: 1.35, color: "#4a443b" }, card.detail),
      ]),
      h("div", { display: "flex", fontSize: 26, color: "#6b645a" }, "Checked on Arkiv · mohar.live"),
    ]),
    h("div", { display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }, [
      // a link with no verdict behind it gets the seal itself, not a stamp that just says the name
      generic ? { type: "img", props: { src: SEAL, width: 300, height: 300, style: { transform: "rotate(-8deg)" } } } : h(
        "div",
        { display: "flex", whiteSpace: "nowrap", fontSize: card.badge.length > 6 ? 50 : card.badge.length > 4 ? 66 : 96, fontWeight: 800, letterSpacing: 2, color: tone.fg, border: `10px solid ${tone.fg}`, borderRadius: 18, padding: "10px 28px", transform: "rotate(-8deg)", background: tone.bg },
        card.badge,
      ),
    ]),
  ])
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const raw = await loadCard(url.searchParams.get("exam") ?? "", url.searchParams.get("w") ?? "")
  const card: Card = { ...raw, exam: plain(raw.exam), headline: plain(raw.headline), detail: plain(raw.detail), badge: plain(raw.badge) }
  const generic = raw === FALLBACK
  // a verdict only changes when the paper is revealed, so a few minutes of caching is safe
  return new ImageResponse(render(card, generic) as never, { width: 1200, height: 630, fonts: FONTS, headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } })
}
