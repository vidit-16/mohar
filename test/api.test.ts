import { afterEach, describe, expect, it, vi } from "vitest"
import { GET as challengeFor, POST as drip } from "../api/drip"
import { solve, solves, zeroBits } from "../src/lib/pow"
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

describe("/api/drip proof of work", () => {
  const A = "0x00000000000000000000000000000000000000aa"
  const B = "0x00000000000000000000000000000000000000bb"
  const get = (address: string) => challengeFor(new Request(`http://localhost/api/drip?address=${address}`))
  const fresh = async (address = A) => (await (await get(address)).json()) as { address: string; salt: `0x${string}`; exp: number; bits: number; sig: `0x${string}` }

  it("hands out a signed, short-lived puzzle per address", async () => {
    vi.stubEnv("DRIP_KEY", "")
    expect((await get(A)).status).toBe(503)
    vi.stubEnv("DRIP_KEY", "0x" + "11".repeat(32))
    expect((await get("nope")).status).toBe(400)
    const c = await fresh()
    expect(c).toMatchObject({ address: A, bits: 17 })
    expect(c.salt).toMatch(/^0x[0-9a-f]{32}$/)
    expect(c.sig).toMatch(/^0x[0-9a-f]{64}$/)
    expect(c.exp - Date.now()).toBeLessThanOrEqual(5 * 60_000)
    expect((await fresh()).salt).not.toBe(c.salt)
  })

  it("refuses every way around the puzzle before touching the chain", async () => {
    vi.stubEnv("DRIP_KEY", "0x" + "11".repeat(32))
    const c = await fresh()
    const nonce = await solve(c)
    const refused = async (body: unknown) => expect((await drip(post(body))).status).toBe(403)
    await refused({ address: A })
    await refused({ address: A, challenge: c })
    await refused({ address: A, challenge: c, nonce: -1 })
    await refused({ address: A, challenge: c, nonce: 1.5 })
    await refused({ address: B, challenge: c, nonce })
    await refused({ address: A, challenge: { ...c, sig: "0x" + "00".repeat(32) }, nonce })
    await refused({ address: A, challenge: { ...c, bits: 1 }, nonce })
    await refused({ address: A, challenge: { ...c, exp: Date.now() - 1 }, nonce })
    await refused({ address: A, challenge: { ...c, exp: Date.now() + 3_600_000 }, nonce })
    let wrong = nonce + 1
    while (solves(c, wrong)) wrong++
    await refused({ address: A, challenge: c, nonce: wrong })
    vi.stubEnv("DRIP_KEY", "0x" + "22".repeat(32))
    await refused({ address: A, challenge: c, nonce })
  })
})

describe("proof of work", () => {
  it("counts leading zero bits", () => {
    expect(zeroBits(new Uint8Array([0, 0, 0xff]))).toBe(16)
    expect(zeroBits(new Uint8Array([0, 0x01]))).toBe(15)
    expect(zeroBits(new Uint8Array([0x80]))).toBe(0)
    expect(zeroBits(new Uint8Array([0x7f]))).toBe(1)
    expect(zeroBits(new Uint8Array([0, 0]))).toBe(16)
  })
  it("finds a nonce that checks out, and only that kind of nonce passes", async () => {
    const c = { salt: "0x" + "ab".repeat(16), address: "0x00000000000000000000000000000000000000AA", bits: 10 } as const
    const n = await solve(c, 100)
    expect(solves(c, n)).toBe(true)
    expect(solves({ ...c, address: c.address.toLowerCase() }, n)).toBe(true)
    expect(solves({ ...c, bits: 64 }, n)).toBe(false)
    for (let i = 0; i < n; i++) expect(solves(c, i)).toBe(false)
  })
})
