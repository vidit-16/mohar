#!/usr/bin/env node
// Leak alerts for a coaching institute: watches exams and prints a line whenever a new witness is
// sealed before an exam starts. Zero dependencies, talks to the public Arkiv RPC directly.
//
//   node examples/leak-alerts.mjs                 all open and sealed exams starting in the next 30 days
//   node examples/leak-alerts.mjs <exam-id> ...   just these exams
//
// Swap the console.log for a Telegram/WhatsApp/email call and you have an alert bot.

const RPC = process.env.ARKIV_RPC ?? "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
const EVERY_MS = 30_000

async function query(q) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "arkiv_query", params: [q, { select: { key: true, creator: true, createdAt: true, attributes: true }, limit: "0xc8" }] }),
  })
  const body = await res.json()
  if (body.error) throw new Error(JSON.stringify(body.error))
  return body.result.data
}
const attr = (e, name) => e.attributes?.find((a) => a.name === name)?.value

async function exams(ids) {
  if (ids.length) return ids.map((id) => ({ id }))
  const now = Date.now()
  const rows = await query(`project = str('mohar-v1') AND opens_at_ms >= u64(${now}) AND opens_at_ms <= u64(${now + 30 * 86_400_000})`)
  const seen = new Map()
  for (const r of rows) seen.set(attr(r, "exam_id"), { id: attr(r, "exam_id"), opensAt: Number(BigInt(attr(r, "opens_at_ms"))) })
  return [...seen.values()]
}

const known = new Set()
let first = true
async function tick(ids) {
  for (const exam of await exams(ids)) {
    const witnesses = await query(`project = str('mohar-v1') AND type = str('witness') AND exam_id = str('${exam.id}')`)
    for (const w of witnesses) {
      if (known.has(w.key)) continue
      known.add(w.key)
      if (!first) console.log(`[${new Date().toISOString()}] new witness for ${exam.id}: ${attr(w, "n_q")} question(s) sealed by ${w.creator}`)
    }
  }
  if (first) console.log(`watching; ${known.size} existing witness(es) loaded`)
  first = false
}

const ids = process.argv.slice(2)
await tick(ids)
setInterval(() => tick(ids).catch((e) => console.error(e.message)), EVERY_MS)
