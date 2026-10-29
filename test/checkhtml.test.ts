import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

// check.html builds its results with innerHTML, and attribute values come from the chain, where anyone can
// write. Every interpolation into markup has to go through esc() or be a value the page computes itself.
const html = readFileSync("public/check.html", "utf8")
const SAFE = [
  /^esc\(/,
  /\.map\(esc\)/,
  /^time\(/,
  /^BigInt\(/,
  /\.length$/,
  /^paper\.filter\(\(q\) => q\.ok\)\.length$/,
  /^paper\.every\(/,
  /^before \? "before" : "after"$/,
  /^verdict$/,
  /^s$/,
  /^summary\.map\(/,
  /^rows\.join\(/,
  /^rows\.length \? `/,
]

describe("check.html escaping", () => {
  const markupLines = html.split("\n").filter((l) => /`[^`]*</.test(l))
  const holes = markupLines.flatMap((l) => [...l.matchAll(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)].map((m) => m[1].trim()))

  it("finds the markup it is meant to guard", () => expect(holes.length).toBeGreaterThan(10))

  it("escapes every value it puts into markup", () => {
    const unsafe = holes.filter((h) => !SAFE.some((re) => re.test(h)) && !/^`/.test(h))
    expect(unsafe).toEqual([])
  })

  it("escapes the question ids in a leak verdict, which come from a chain attribute", () => {
    expect(html).toContain("LEAK: ${hits.map(esc).join(\", \")}")
  })
})
