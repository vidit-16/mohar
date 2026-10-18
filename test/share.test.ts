import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { cardFor, cardMeta, FALLBACK, fmtDuration, injectMeta, loadCard } from "../api/_share"
import { fmtDuration as pageDuration } from "../src/ui/format"

const K = "0x" + "ab".repeat(32)
const base = { kind: "sealed" as const, title: "Demo Prelims", deadline: 1_000_000 }
const w = (over: object) => ({ key: K, at: 1_000_000 - 120_000, before: true, total: 4, hits: [] as string[], verdict: "no-match" as const, ...over })

describe("share card text", () => {
  it("says LEAK with the count and timing for a leak", () => {
    const c = cardFor({ ...base, witnesses: [w({ verdict: "leak", hits: ["A-Q2", "A-Q4", "A-Q5"] })] }, K)
    expect(c).toMatchObject({ tone: "danger", badge: "LEAK", headline: "Held 3 real questions before the exam", exam: "Demo Prelims" })
    expect(c.detail).toBe("Recorded 2m before the exam. 3 of 4 fingerprints match the official paper, on a public record nobody can edit.")
    expect(cardFor({ ...base, witnesses: [w({ verdict: "leak", hits: ["A-Q1"] })] }, K).headline).toBe("Held 1 real question before the exam")
  })
  it("covers too late, waiting (sealed and open) and no match", () => {
    expect(cardFor({ ...base, witnesses: [w({ verdict: "late", before: false, at: 1_014_000 })] }, K)).toMatchObject({ badge: "TOO LATE", detail: "Recorded 14s after the exam, so it can't show anyone had the paper early." })
    expect(cardFor({ ...base, witnesses: [w({ verdict: "waiting" })] }, K).detail).toMatch(/checked automatically when the paper is revealed/)
    expect(cardFor({ ...base, kind: "open", witnesses: [w({ verdict: "waiting" })] }, K).detail).toMatch(/against the official paper once it's out/)
    expect(cardFor({ ...base, witnesses: [w({})] }, K)).toMatchObject({ badge: "NO MATCH", tone: "good" })
  })
  it("falls back for unknown exams and witnesses, matching keys case-insensitively", () => {
    expect(cardFor({ kind: "none" }, K)).toBe(FALLBACK)
    expect(cardFor({ ...base, witnesses: [w({})] }, "0x" + "cd".repeat(32))).toBe(FALLBACK)
    expect(cardFor({ ...base, witnesses: [w({})] }, K.toUpperCase().replace("0X", "0x"))).not.toBe(FALLBACK)
  })
  it("refuses junk input without touching the network", async () => {
    expect(await loadCard("", K)).toBe(FALLBACK)
    expect(await loadCard("x".repeat(121), K)).toBe(FALLBACK)
    expect(await loadCard("EXAM", "0x123")).toBe(FALLBACK)
  })
  it("words durations exactly like the exam page", () => {
    for (const ms of [0, 999, 14_000, 59_999, 60_000, 125_000, 3_600_000, 3_660_000, 86_400_000, 90_000_000, -125_000]) expect(fmtDuration(ms), String(ms)).toBe(pageDuration(ms))
  })
})

describe("preview tags", () => {
  const html = readFileSync("index.html", "utf8")
  it("swaps the title and every preview tag, keeping the rest of the page", () => {
    const card = cardFor({ ...base, witnesses: [w({ verdict: "leak", hits: ["A-Q1"] })] }, K)
    const out = injectMeta(html, cardMeta(card, "https://m.app/api/card?x=1&y=2", "https://m.app/?exam=E&w=" + K))
    expect(out).toContain("<title>Leak: Held 1 real question before the exam · Demo Prelims</title>")
    expect(out).toContain('<meta property="og:image" content="https://m.app/api/card?x=1&amp;y=2" />')
    expect(out).toContain('<meta name="twitter:title" content="Leak: Held 1 real question before the exam · Demo Prelims" />')
    expect(out.match(/property="og:title"/g)).toHaveLength(1)
    expect(out.match(/name="twitter:image"/g)).toHaveLength(1)
    // tags the page doesn't have yet (twitter:title…) are added before </head>; nothing else moves
    const rest = (h: string) => h.replace(/<title>[^<]*<\/title>|<meta [^>]*>/g, "").replace(/\s+/g, " ")
    expect(rest(out)).toBe(rest(html))
  })
  it("escapes whatever the exam title says", () => {
    const out = injectMeta(html, cardMeta({ ...FALLBACK, exam: '"><script>alert(1)</script>', headline: "x" }, "i", "u"))
    expect(out).not.toContain("<script>alert(1)")
    expect(out).toContain("&quot;&gt;&lt;script&gt;")
  })
})

describe("/api/share", () => {
  it("falls back to the plain page if anything goes wrong", async () => {
    const { GET } = await import("../api/share")
    const real = globalThis.fetch
    globalThis.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch
    try {
      const res = await GET(new Request(`https://m.app/?exam=E&w=${K}`))
      expect(res.status).toBe(302)
      expect(res.headers.get("location")).toBe(`https://m.app/index.html?exam=E&w=${K}`)
    } finally {
      globalThis.fetch = real
    }
  })
  it("serves the page with this witness's preview tags", async () => {
    const { GET } = await import("../api/share")
    const real = globalThis.fetch
    globalThis.fetch = (async () => new Response(readFileSync("index.html", "utf8"))) as typeof fetch
    try {
      const res = await GET(new Request(`https://m.app/?exam=E&w=0x123`))
      const body = await res.text()
      expect(res.headers.get("content-type")).toMatch(/text\/html/)
      expect(body).toContain('<meta property="og:image" content="https://m.app/api/card?exam=E&amp;w=0x123" />')
      expect(body).toContain('<script type="module"')
    } finally {
      globalThis.fetch = real
    }
  })
})

describe("middleware", () => {
  it("sends only shared witness links to /api/share", async () => {
    const { default: middleware } = await import("../middleware")
    const real = globalThis.fetch
    const seen: string[] = []
    globalThis.fetch = (async (u: URL | string) => (seen.push(String(u)), new Response("ok"))) as typeof fetch
    try {
      expect(middleware(new Request("https://m.app/"))).toBeUndefined()
      expect(middleware(new Request("https://m.app/?exam=E"))).toBeUndefined()
      expect(middleware(new Request("https://m.app/?w=0x1"))).toBeUndefined()
      await middleware(new Request(`https://m.app/?exam=E&w=${K}`))
      expect(seen).toEqual([`https://m.app/api/share?exam=E&w=${K}`])
    } finally {
      globalThis.fetch = real
    }
  })
})
