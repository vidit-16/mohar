// The image a chat app shows when someone shares a witness link: the verdict, read live from Arkiv.
//   GET /api/card?exam=<exam id>&w=<witness key>   → 1200×630 PNG
import { ImageResponse } from "@vercel/og"
import { type Card, loadCard, type Tone } from "./_share.js"

const TONES: Record<Tone, { fg: string; bg: string }> = {
  danger: { fg: "#b42318", bg: "#fde8e6" },
  good: { fg: "#16794a", bg: "#e3f4ea" },
  warn: { fg: "#a45a06", bg: "#fbefdc" },
  info: { fg: "#2f5fb3", bg: "#e5edfb" },
}

type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown } }
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } })

function render(card: Card) {
  const tone = TONES[card.tone]
  return h("div", { width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f7f5f0", padding: "64px 72px", fontFamily: "sans-serif", color: "#1d1a16" }, [
    h("div", { display: "flex", alignItems: "center", justifyContent: "space-between" }, [
      h("div", { display: "flex", alignItems: "center", gap: 16 }, [
        h("div", { width: 44, height: 44, borderRadius: 22, background: "#b4532a", display: "flex" }),
        h("div", { fontSize: 34, fontWeight: 700, letterSpacing: 2 }, "MOHAR"),
      ]),
      h("div", { display: "flex", padding: "10px 22px", borderRadius: 999, background: tone.bg, color: tone.fg, fontSize: 28, fontWeight: 700, letterSpacing: 2 }, card.badge),
    ]),
    h("div", { display: "flex", flexDirection: "column", gap: 22 }, [
      h("div", { fontSize: 66, fontWeight: 700, lineHeight: 1.08, color: card.tone === "danger" ? tone.fg : "#1d1a16" }, card.headline),
      h("div", { fontSize: 32, lineHeight: 1.35, color: "#4a443b" }, card.detail),
    ]),
    h("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 26, color: "#6b645a" }, [
      h("div", { display: "flex", maxWidth: 760 }, card.exam),
      h("div", { display: "flex" }, "Checked on Arkiv · mohar.live"),
    ]),
  ])
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const card = await loadCard(url.searchParams.get("exam") ?? "", url.searchParams.get("w") ?? "")
  // a verdict only changes when the paper is revealed, so a few minutes of caching is safe
  return new ImageResponse(render(card) as never, { width: 1200, height: 630, headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } })
}
