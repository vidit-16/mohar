// The image a chat app shows when someone shares a witness link: the verdict, read live from Arkiv.
//   GET /api/card?exam=<exam id>&w=<witness key>   → 1200×630 PNG
import { ImageResponse } from "@vercel/og"
import { type Card, loadCard, plain, type Tone } from "./_share.js"

const TONES: Record<Tone, { fg: string; bg: string }> = {
  danger: { fg: "#b42318", bg: "#fde8e6" },
  good: { fg: "#16794a", bg: "#e3f4ea" },
  warn: { fg: "#a45a06", bg: "#fbefdc" },
  info: { fg: "#2f5fb3", bg: "#e5edfb" },
}

type Node = { type: string; props: Record<string, unknown> }
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } })

// The card a chat app shows: the verdict as a rubber stamp, so it reads before anyone opens the link.
function render(card: Card, origin: string) {
  const tone = TONES[card.tone]
  return h("div", { width: "100%", height: "100%", display: "flex", background: "#f7f5f0", padding: "60px 72px", fontFamily: "sans-serif", color: "#1d1a16" }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: 720 }, [
      h("div", { display: "flex", alignItems: "center", gap: 18 }, [
        { type: "img", props: { src: `${origin}/favicon.svg`, width: 64, height: 64 } },
        h("div", { display: "flex", flexDirection: "column" }, [
          h("div", { fontSize: 30, fontWeight: 700, letterSpacing: 3 }, "MOHAR"),
          h("div", { fontSize: 24, color: "#6b645a", maxWidth: 600 }, card.exam),
        ]),
      ]),
      h("div", { display: "flex", flexDirection: "column", gap: 20 }, [
        h("div", { fontSize: 64, fontWeight: 700, lineHeight: 1.06 }, card.headline),
        h("div", { fontSize: 30, lineHeight: 1.35, color: "#4a443b" }, card.detail),
      ]),
      h("div", { display: "flex", fontSize: 26, color: "#6b645a" }, "Checked on Arkiv · mohar.live"),
    ]),
    h("div", { display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }, [
      h(
        "div",
        { display: "flex", fontSize: card.badge.length > 6 ? 64 : 92, fontWeight: 800, letterSpacing: 2, color: tone.fg, border: `10px solid ${tone.fg}`, borderRadius: 18, padding: "10px 28px", transform: "rotate(-8deg)", background: tone.bg },
        card.badge,
      ),
    ]),
  ])
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const raw = await loadCard(url.searchParams.get("exam") ?? "", url.searchParams.get("w") ?? "")
  const card: Card = { ...raw, exam: plain(raw.exam), headline: plain(raw.headline), detail: plain(raw.detail), badge: plain(raw.badge) }
  // a verdict only changes when the paper is revealed, so a few minutes of caching is safe
  return new ImageResponse(render(card, url.origin) as never, { width: 1200, height: 630, headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } })
}
