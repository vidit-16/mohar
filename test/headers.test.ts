import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"

// The CSP allows inline scripts only by hash. Editing the inline script in index.html or check.html changes its
// hash, and the page would silently stop running in production, so the hashes are checked here.
const csp = (JSON.parse(readFileSync("vercel.json", "utf8")).headers as { source: string; headers: { key: string; value: string }[] }[])
  .find((h) => h.source === "/(.*)")!
  .headers.find((h) => h.key === "Content-Security-Policy")!.value

const inlineScripts = (file: string) =>
  [...readFileSync(file, "utf8").replace(/\r\n/g, "\n").matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (m) => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`,
  )

describe("security headers", () => {
  for (const file of ["index.html", "public/check.html"])
    it(`allows every inline script in ${file} by hash`, () => {
      const hashes = inlineScripts(file)
      expect(hashes.length).toBeGreaterThan(0)
      for (const h of hashes) expect(csp, `${file} ${h}`).toContain(h)
    })

  it("never allows unsafe-inline or eval for scripts", () => {
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!
    expect(scriptSrc).not.toMatch(/unsafe-inline|unsafe-eval/)
  })

  it("can't be framed", () => expect(csp).toContain("frame-ancestors 'none'"))
})
