import { afterEach, describe, expect, it, vi } from "vitest"
import { GET as status } from "../api/status"

const get = (exam: string) => status(new Request(`http://localhost/api/status?exam=${encodeURIComponent(exam)}`))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("/api/status", () => {
  it("refuses exam ids that could break out of the query", async () => {
    for (const bad of ["", "x') OR (1=1", "a b", "x".repeat(121), "<script>"]) expect((await get(bad)).status, bad).toBe(400)
  })

  it("returns a version made of the record count and the newest block, cached for 2s at the edge", async () => {
    const fetch = vi.fn(async () => Response.json({ result: { data: [{ createdAt: "0x10" }, { createdAt: "0x2a" }, { createdAt: "0x05" }] } }))
    vi.stubGlobal("fetch", fetch)
    const res = await get("DSPSC-PRE26-10170937")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ version: "3:42" })
    expect(res.headers.get("cache-control")).toContain("s-maxage=2")
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, { body: string }])[1].body).params[0]).toBe("project = str('mohar-v1') AND exam_id = str('DSPSC-PRE26-10170937')")
  })

  it("says so instead of caching a bad answer when the upstream fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "rate limited" } }, { status: 429 })))
    const res = await get("EXAM-1")
    expect(res.status).toBe(502)
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})

describe("drip limits", () => {
  it("defaults to 5 per IP and 120 per hour", async () => {
    const { LIMITS } = await import("../api/drip")
    expect(LIMITS).toEqual({ perIpPerHour: 5, maxPerHour: 120 })
  })
  it("can be raised for an event through the env, within hard caps", async () => {
    vi.stubEnv("DRIP_PER_IP_PER_HOUR", "300")
    vi.stubEnv("DRIP_MAX_PER_HOUR", "99999")
    const { LIMITS } = await import("../api/drip")
    expect(LIMITS).toEqual({ perIpPerHour: 300, maxPerHour: 2000 })
  })
  it("ignores nonsense values", async () => {
    vi.stubEnv("DRIP_PER_IP_PER_HOUR", "-4")
    vi.stubEnv("DRIP_MAX_PER_HOUR", "lots")
    const { LIMITS } = await import("../api/drip")
    expect(LIMITS).toEqual({ perIpPerHour: 5, maxPerHour: 120 })
  })
})
