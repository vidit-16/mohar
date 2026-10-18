import { describe, expect, it } from "vitest"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { GET as challengeFor, POST as drip } from "../../api/drip"
import { solve } from "../../src/lib/pow"
import { POST as rpc } from "../../api/rpc"
import { publicClient } from "../../src/lib/mohar"

const post = (body: unknown, ip = "203.0.113.7") =>
  new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) })

describe("/api/rpc against Tiramisu", () => {
  it("forwards a real arkiv_query", async () => {
    const res = await rpc(post({ jsonrpc: "2.0", id: 1, method: "arkiv_query", params: ["project = str('mohar-v1') AND exam_id = str('DSPSC-PRE26-10170937')", { select: { key: true }, limit: "0x5" }] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.data.length).toBeGreaterThan(0)
  })
})

describe("/api/drip against Tiramisu", () => {
  it("funds a fresh wallet once and refuses to fund it again", async () => {
    if (!process.env.DRIP_KEY) return
    const fresh = privateKeyToAccount(generatePrivateKey()).address
    const challenge = await (await challengeFor(new Request(`http://localhost/api/drip?address=${fresh}`))).json()
    const nonce = await solve(challenge)
    const first = await drip(post({ address: fresh, challenge, nonce }, `198.51.100.${Math.floor(Math.random() * 250)}`))
    expect(first.status).toBe(200)
    const { hash } = await first.json()
    await publicClient().waitForTransactionReceipt({ hash })
    expect(await publicClient().getBalance({ address: fresh })).toBeGreaterThan(0n)
    // replaying the same solved puzzle doesn't help: the wallet isn't empty any more
    const again = await drip(post({ address: fresh, challenge, nonce }, `198.51.100.${Math.floor(Math.random() * 250)}`))
    expect(again.status).toBe(409)
  })
})
