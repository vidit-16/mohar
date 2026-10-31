// Every record of one exam and the time of every block they landed in, in one response the CDN keeps for 2 seconds.
// A page then needs one fast request instead of a query plus a lookup per block, and a room of phones costs Arkiv
// about one query every 2s. It is only a faster read of the same public records: the page decides trust itself,
// and falls back to reading Arkiv directly if this is down.
import { EXAM_ID } from "./status.js"

const UPSTREAM = "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
const SELECT = { key: true, creator: true, owner: true, createdAt: true, expiresAt: true, creationFlags: true, attributes: true, payload: true }

type Raw = { createdAt: string }

export async function GET(req: Request) {
  const exam = new URL(req.url).searchParams.get("exam") ?? ""
  if (!EXAM_ID.test(exam)) return Response.json({ error: "bad exam id" }, { status: 400 })
  const key = process.env.ARKIV_KEY?.trim()
  const url = key ? `${UPSTREAM}/${key}` : UPSTREAM
  const call = async (body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    return res.json()
  }
  const t0 = Date.now()
  try {
    const q = await call({ jsonrpc: "2.0", id: 1, method: "arkiv_query", params: [`project = str('mohar-v1') AND exam_id = str('${exam}')`, { select: SELECT, limit: "0xc8" }] })
    if (!q?.result?.data) throw new Error("no data")
    const data = q.result.data as Raw[]
    const blocks = [...new Set(data.map((r) => r.createdAt))]
    const times: Record<string, number> = {}
    for (let i = 0; i < blocks.length; i += 20) {
      const part = blocks.slice(i, i + 20)
      const got = (await call(part.map((b, j) => ({ jsonrpc: "2.0", id: j, method: "eth_getBlockByNumber", params: [b, false] })))) as { id: number; result?: { timestamp: string } }[]
      for (const r of got) if (r.result) times[part[r.id]] = Number(BigInt(r.result.timestamp)) * 1000
    }
    return Response.json(
      { data, cursor: q.result.cursor ?? null, times },
      {
        headers: {
          "cache-control": "public, max-age=0, s-maxage=2, stale-while-revalidate=2",
          "vercel-cdn-cache-control": "max-age=2",
          // how long Arkiv took, to tell the network apart from the chain when a page feels slow
          "server-timing": `arkiv;dur=${Date.now() - t0}`,
        },
      },
    )
  } catch {
    return Response.json({ error: "upstream" }, { status: 502, headers: { "cache-control": "no-store" } })
  }
}
