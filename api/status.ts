// A cheap "has anything changed?" signal for one exam: how many records it has and the newest block among them.
// The CDN caches it for 2 seconds, so a whole room of phones polling it costs Arkiv about one query every 2s,
// and each page reloads the exam the moment the signal changes. It says nothing about trust; the page still
// decides what counts from the records themselves.
import { arkiv } from "./_arkiv.js"

export const EXAM_ID = /^[A-Za-z0-9._-]{1,120}$/

export async function GET(req: Request) {
  const exam = new URL(req.url).searchParams.get("exam") ?? ""
  if (!EXAM_ID.test(exam)) return Response.json({ error: "bad exam id" }, { status: 400 })
  const res = await arkiv(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "arkiv_query",
      params: [`project = str('mohar-v1') AND exam_id = str('${exam}')`, { select: { key: true, createdAt: true }, limit: "0xc8" }],
    }),
  )
  const body = (await res.json().catch(() => null)) as { result?: { data: { createdAt: string }[] } } | null
  const rows = body?.result?.data
  if (!res.ok || !rows) return Response.json({ error: "upstream" }, { status: 502, headers: { "cache-control": "no-store" } })
  const latest = rows.reduce((m, r) => (BigInt(r.createdAt) > m ? BigInt(r.createdAt) : m), 0n)
  return Response.json(
    { version: `${rows.length}:${latest}` },
    { headers: { "cache-control": "public, max-age=0, s-maxage=2, stale-while-revalidate=2", "vercel-cdn-cache-control": "max-age=2" } },
  )
}
