import { describe, expect, it } from "vitest"
import { GET as records } from "../../api/records"
import { examRecords, publicClient, recordsFromRaw, RPC_URL } from "../../src/lib/mohar"

// /api/records is only a faster way to read the same records, so what the page builds from it has to be exactly what
// the SDK builds: same rows, same attribute types (64-bit numbers as bigints), same payloads.
const client = publicClient(RPC_URL ?? "https://rpc.tiramisu.db-chain.testnet.arkiv.network")
const same = (x: unknown) => JSON.stringify(x, (_, v) => (typeof v === "bigint" ? `n${v}` : typeof v === "string" && /^0x[0-9a-fA-F]+$/.test(v) ? v.toLowerCase() : v))

describe("/api/records against Tiramisu", () => {
  for (const examId of ["DSPSC-PRE26-10170937", "DSPSC-PRE26-U10170941", "open-demo-mock-test-open-exam-e96c10"]) {
    it(`matches the SDK for ${examId}, with a time for every block`, async () => {
      const res = await records(new Request(`http://localhost/api/records?exam=${examId}`))
      expect(res.status).toBe(200)
      expect(res.headers.get("cache-control")).toContain("s-maxage=2")
      const raw = await res.json()
      const fast = recordsFromRaw(raw)
      expect(same(fast)).toBe(same(await examRecords(client, examId)))
      const rows = [...fast.commits, ...fast.reveals, ...fast.entries, ...fast.witnesses]
      for (const r of rows) expect(raw.times[`0x${r.createdAt.toString(16)}`]).toBeGreaterThan(0)
    })
  }

  it("refuses an exam id that could change the query", async () => {
    const res = await records(new Request("http://localhost/api/records?exam=x') OR (project = str('mohar-v1"))
    expect(res.status).toBe(400)
  })
})
