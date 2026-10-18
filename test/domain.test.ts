import { describe, expect, it } from "vitest"
import { fetchProof, normaliseDomain, parseProof } from "../src/lib/domain"

const A = "0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6"

describe("normaliseDomain", () => {
  it("accepts a bare host, a URL or a trailing dot", () => {
    expect(normaliseDomain("uppsc.up.nic.in")).toBe("uppsc.up.nic.in")
    expect(normaliseDomain("https://UPPSC.up.nic.in/notices?x=1")).toBe("uppsc.up.nic.in")
    expect(normaliseDomain("mohar-in.vercel.app.")).toBe("mohar-in.vercel.app")
  })

  it("stays fast on hostile input", () => {
    const t = performance.now()
    for (const bad of ["#".repeat(100_000), "/".repeat(100_000), "a.".repeat(50_000) + "!", "a".repeat(100_000) + ".in"]) expect(normaliseDomain(bad)).toBeNull()
    expect(performance.now() - t).toBeLessThan(200)
  })

  it("rejects anything that isn't a public host name", () => {
    for (const bad of ["", "localhost", "127.0.0.1", "exam body.in", "-a.in", "a..in", "javascript:alert(1)", "x.1", "a".repeat(260) + ".in"]) {
      expect(normaliseDomain(bad), bad).toBeNull()
    }
  })
})

describe("parseProof", () => {
  it("reads a valid file", () => {
    expect(parseProof("x.in", { name: " Demo Body ", issuers: [A] })).toEqual({ domain: "x.in", name: "Demo Body", issuers: [A] })
  })

  it("refuses malformed files", () => {
    expect(() => parseProof("x.in", null)).toThrow()
    expect(() => parseProof("x.in", { issuers: [A] })).toThrow(/name/)
    expect(() => parseProof("x.in", { name: "x", issuers: [] })).toThrow(/issuers/)
    expect(() => parseProof("x.in", { name: "x", issuers: "0x" + "a".repeat(40) })).toThrow(/issuers/)
    expect(() => parseProof("x.in", { name: "x", issuers: [A, "0x123"] })).toThrow(/not an address/)
    expect(() => parseProof("x.in", { name: "x".repeat(121), issuers: [A] })).toThrow(/name/)
  })
})

describe("fetchProof", () => {
  it("fetches only https://<domain>/.well-known/mohar.json and refuses redirects", async () => {
    let seen: [string, RequestInit | undefined] | undefined
    const get = (async (url: string, init?: RequestInit) => {
      seen = [url, init]
      return new Response(JSON.stringify({ name: "Demo", issuers: [A] }))
    }) as typeof fetch
    await expect(fetchProof("https://Demo.gov.in/anything", get)).resolves.toMatchObject({ domain: "demo.gov.in", issuers: [A] })
    expect(seen?.[0]).toBe("https://demo.gov.in/.well-known/mohar.json")
    expect(seen?.[1]?.redirect).toBe("error")
    expect(seen?.[1]?.credentials).toBe("omit")
  })

  it("reports a missing file and a bad domain", async () => {
    const missing = (async () => new Response("nope", { status: 404 })) as typeof fetch
    await expect(fetchProof("demo.gov.in", missing)).rejects.toThrow(/404/)
    await expect(fetchProof("not a domain", missing)).rejects.toThrow(/valid domain/)
    const offline = (async () => { throw new TypeError("Failed to fetch") }) as typeof fetch
    await expect(fetchProof("demo.gov.in", offline)).rejects.toThrow(/couldn't load https:\/\/demo\.gov\.in\/\.well-known\/mohar\.json/)
  })
})

describe("domain proof edge cases", () => {
  const A = "0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6"
  it("trims, lowercases and strips only a leading http(s)://", () => {
    expect(normaliseDomain("  UPPSC.up.nic.in  ")).toBe("uppsc.up.nic.in")
    expect(normaliseDomain("http://x.co")).toBe("x.co")
    expect(normaliseDomain("ahttps://x.in")).toBeNull()
    expect(normaliseDomain("x.co")).toBe("x.co")
  })
  it("anchors the host pattern at both ends and caps the length at 253", () => {
    expect(normaliseDomain("uppsc.nic.in_")).toBeNull()
    const long = Array.from({ length: 5 }, () => "a".repeat(50)).join(".") + ".in"
    expect(long.length).toBeGreaterThan(253)
    expect(normaliseDomain(long)).toBeNull()
    expect(normaliseDomain(long.slice(51))).toBe(long.slice(51))
  })
  it("refuses non-objects and blank names with clear messages", () => {
    expect(() => parseProof("x.in", "a string")).toThrow(/not a JSON object/)
    expect(() => parseProof("x.in", null)).toThrow(/not a JSON object/)
    expect(() => parseProof("x.in", { name: "   ", issuers: [A] })).toThrow(/name/)
    expect(parseProof("x.in", { name: "x".repeat(120), issuers: [A] }).name).toHaveLength(120)
  })
  it("takes up to 10 addresses, only real strings, matched whole", () => {
    expect(parseProof("x.in", { name: "x", issuers: Array(10).fill(A) }).issuers).toHaveLength(10)
    expect(() => parseProof("x.in", { name: "x", issuers: Array(11).fill(A) })).toThrow(/1 to 10/)
    expect(() => parseProof("x.in", { name: "x", issuers: [{ toString: () => A }] })).toThrow(/not an address/)
    expect(() => parseProof("x.in", { name: "x", issuers: [A + "ff"] })).toThrow(/not an address/)
    expect(() => parseProof("x.in", { name: "x", issuers: ["zz" + A] })).toThrow(/not an address/)
  })
  it("asks for json", async () => {
    let init: RequestInit | undefined
    await fetchProof("x.co", (async (_: string, i?: RequestInit) => ((init = i), new Response(JSON.stringify({ name: "x", issuers: [A] })))) as typeof fetch)
    expect((init?.headers as Record<string, string>).accept).toBe("application/json")
  })
})
