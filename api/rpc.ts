// Read-only JSON-RPC proxy: adds the Arkiv access key on the server so it never ships to browsers.
// The site falls back to the public RPC if this is down, so nothing depends on it.
import { arkiv } from "./_arkiv.js"

const READS = new Set([
  "arkiv_query",
  "arkiv_getBlockTiming",
  "arkiv_getEntityCount",
  "eth_blockNumber",
  "eth_chainId",
  "eth_getBalance",
  "eth_getBlockByNumber",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
])

type Call = { jsonrpc: "2.0"; id: number | string; method: string; params?: unknown[] }

export async function POST(req: Request) {
  let body: Call | Call[]
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 })
  }
  const calls = Array.isArray(body) ? body : [body]
  if (calls.length === 0 || calls.length > 20 || calls.some((c) => !READS.has(c?.method))) {
    return Response.json({ error: "only read methods are allowed" }, { status: 403 })
  }
  const res = await arkiv(JSON.stringify(body))
  // a block by explicit number never changes, everything else is live
  const immutable = calls.every((c) => c.method === "eth_getBlockByNumber" && typeof c.params?.[0] === "string" && c.params[0].startsWith("0x"))
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": "application/json",
      "cache-control": immutable ? "public, s-maxage=86400" : "no-store",
    },
  })
}
