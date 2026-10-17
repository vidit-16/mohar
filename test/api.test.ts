import { afterEach, describe, expect, it, vi } from "vitest"
import { POST as drip } from "../api/drip"
import { POST as rpc } from "../api/rpc"

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) })

afterEach(() => vi.unstubAllEnvs())

describe("/api/rpc", () => {
  it("refuses anything that isn't a read", async () => {
    for (const method of ["eth_sendRawTransaction", "eth_sendTransaction", "debug_traceTransaction", "anything"]) {
      expect((await rpc(post({ jsonrpc: "2.0", id: 1, method, params: [] }))).status, method).toBe(403)
    }
  })
  it("refuses a batch that sneaks a write in", async () => {
    const batch = [{ jsonrpc: "2.0", id: 1, method: "eth_blockNumber" }, { jsonrpc: "2.0", id: 2, method: "eth_sendRawTransaction", params: ["0x"] }]
    expect((await rpc(post(batch))).status).toBe(403)
  })
  it("refuses empty or oversized batches and bad json", async () => {
    expect((await rpc(post([]))).status).toBe(403)
    expect((await rpc(post(Array.from({ length: 21 }, (_, i) => ({ jsonrpc: "2.0", id: i, method: "eth_blockNumber" }))))).status).toBe(403)
    expect((await rpc(post("{not json"))).status).toBe(400)
  })
})

describe("/api/drip", () => {
  it("is off until a drip key is configured", async () => {
    vi.stubEnv("DRIP_KEY", "")
    expect((await drip(post({ address: "0x000000000000000000000000000000000000dEaD" }))).status).toBe(503)
  })
  it("rejects bad input before touching the chain", async () => {
    vi.stubEnv("DRIP_KEY", "0x" + "11".repeat(32))
    expect((await drip(post({ address: "not-an-address" }))).status).toBe(400)
    expect((await drip(post({}))).status).toBe(400)
    expect((await drip(post("{nope"))).status).toBe(400)
  })
})
