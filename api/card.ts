// The image a chat app shows when someone shares a witness link: the verdict, read live from Arkiv.
//   GET /api/card?exam=<exam id>&w=<witness key>   → 1200×630 PNG
import { readFileSync } from "node:fs"
import { ImageResponse } from "@vercel/og"
import { type Card, FALLBACK, loadCard, plain, type Tone } from "./_share.js"

// the renderer's built-in font has no bold, so the card brings the site's own faces
const font = (file: string) => readFileSync(new URL(`./fonts/${file}`, import.meta.url))
const FONTS = [
  { name: "Geist", data: font("geist-400.ttf"), weight: 400 as const, style: "normal" as const },
  { name: "Geist", data: font("geist-600.ttf"), weight: 600 as const, style: "normal" as const },
]
// the flat seal, drawn from the app's own geometry and embedded, so the card never depends on fetching anything
// Mohar's lac seal, the logo and the mark of a caught leak, rendered once from the site's seal: the card renderer can't light wax
const LAC = `data:image/png;base64,${readFileSync(new URL("./assets/lac.png", import.meta.url)).toString("base64")}`

const TONES: Record<Tone, string> = { danger: "#c4281a", good: "#1a7a45", warn: "#9a5a00", info: "#2b5bd7" }

type Node = { type: string; props: Record<string, unknown> }
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } })

// The card a chat app shows: the verdict in big type, and Mohar's seal pressed on it when a leak was caught.
function render(card: Card, generic: boolean) {
  const caught = card.tone === "danger" && !generic
  return h("div", { width: "100%", height: "100%", display: "flex", background: "#fbfaf8", padding: "64px 72px", fontFamily: "Geist", color: "#0f0f10" }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: caught || generic ? 720 : 1056 }, [
      h("div", { display: "flex", alignItems: "center", gap: 16 }, [
        { type: "img", props: { src: LAC, width: 60, height: 60, style: { margin: -4 } } },
        h("div", { display: "flex", flexDirection: "column" }, [
          h("div", { fontSize: 30, fontWeight: 600, letterSpacing: -0.8 }, "Mohar"),
          ...(generic ? [] : [h("div", { fontSize: 24, color: "#64625d", maxWidth: 640 }, card.exam)]),
        ]),
      ]),
      h("div", { display: "flex", flexDirection: "column", gap: 18 }, [
        ...(generic ? [] : [h("div", { fontSize: 30, fontWeight: 600, color: TONES[card.tone] }, card.badge)]),
        h("div", { fontSize: 66, fontWeight: 600, lineHeight: 1.02, letterSpacing: -2.6 }, card.headline),
        h("div", { fontSize: 30, lineHeight: 1.35, color: "#64625d" }, card.detail),
      ]),
      h("div", { display: "flex", fontSize: 24, color: "#75736d" }, "Checked on Arkiv · mohar.live"),
    ]),
    ...(caught || generic
      ? [
          h("div", { display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }, [
            caught ? { type: "img", props: { src: LAC, width: 330, height: 330, style: { transform: "rotate(-10deg)" } } } : { type: "img", props: { src: LAC, width: 330, height: 330 } },
          ]),
        ]
      : []),
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
