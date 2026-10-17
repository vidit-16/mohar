#!/usr/bin/env node
// Rebuilds every Mohar verdict for one exam straight from the public Arkiv RPC.
// Zero dependencies on purpose: copy this one file anywhere with Node 18+ and run it,
// even if the website and this repo are gone.
//
//   node verify.mjs <exam-id> [issuer-address] [--paper paper.txt]
//
// For an open exam (no issuer seal), pass the official paper as a text file, one question per line.

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const RPC = process.env.ARKIV_RPC ?? "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
const DEFAULT_ISSUER = "0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6"

export const sha = (s) => "0x" + createHash("sha256").update(s, "utf8").digest("hex")
export const normalise = (t) =>
  t.normalize("NFKC").toLowerCase().replace(/^\s*(q(uestion)?\s*)?\(?\d{1,3}[).:-]?\s+/u, "").replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim()
export const lines = (t) => t.split(/\r?\n/).map((l) => l.trim()).filter((l) => normalise(l))
const same = (a, b) => a?.toLowerCase() === b?.toLowerCase()

async function rpc(method, params) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) throw new Error(`${method}: ${JSON.stringify(body.error ?? body).slice(0, 200)}`)
  return body.result
}

const attr = (e, name) => e.attributes?.find((a) => a.name === name)?.value
const json = (e) => {
  try {
    return JSON.parse(Buffer.from(e.payload.slice(2), "hex").toString("utf8"))
  } catch {
    return null
  }
}

async function main() {
  const args = process.argv.slice(2)
  const paperAt = args.indexOf("--paper")
  const paperFile = paperAt >= 0 ? args.splice(paperAt, 2)[1] : undefined
  const [examId, issuer = DEFAULT_ISSUER] = args
  if (!examId) {
    console.error("usage: node verify.mjs <exam-id> [issuer-address] [--paper paper.txt]")
    process.exit(1)
  }

  const select = { key: true, creator: true, createdAt: true, attributes: true, payload: true }
  const records = []
  let cursor
  do {
    const r = await rpc("arkiv_query", [`project = str('mohar-v1') AND exam_id = str('${examId.replace(/'/g, "")}')`, { select, limit: "0xc8", ...(cursor && { cursor }) }])
    records.push(...r.data)
    cursor = r.cursor
  } while (cursor)

  const typed = (t) => records.filter((e) => attr(e, "type") === t)
  const commits = typed("paper_commit").filter((e) => same(e.creator, issuer))
  const forged = typed("paper_commit").filter((e) => !same(e.creator, issuer))
  const reveals = typed("reveal").filter((e) => same(e.creator, issuer))
  const entry = typed("open_exam").sort((a, b) => Number(BigInt(a.createdAt) - BigInt(b.createdAt)))[0]
  const witnesses = typed("witness")

  const blockMs = new Map()
  const timeOf = async (block) => {
    if (!blockMs.has(block)) blockMs.set(block, Number(BigInt((await rpc("eth_getBlockByNumber", [block, false])).timestamp)) * 1000)
    return blockMs.get(block)
  }

  let opensAt, paper = []
  if (commits.length) {
    opensAt = Number(BigInt(attr(commits[0], "opens_at_ms")))
    for (const r of reveals) {
      const p = json(r)
      const sealed = json(commits.find((c) => attr(c, "set_code") === attr(r, "set_code")))?.commits ?? []
      p.questions.forEach((q, i) => paper.push({ id: `${attr(r, "set_code")}-Q${i + 1}`, hash: sha(normalise(q)), ok: sealed[i] === sha(`${p.salts[i]}|${normalise(q)}`) }))
    }
    console.log(`sealed exam ${examId}: ${commits.length} set(s) by ${issuer}, ${forged.length} look-alike(s) from other wallets ignored`)
    if (paper.length) console.log(`paper revealed: ${paper.filter((q) => q.ok).length}/${paper.length} questions match the seal`)
  } else if (entry) {
    opensAt = Number(BigInt(attr(entry, "opens_at_ms")))
    console.log(`open exam ${examId}, added by ${entry.creator}`)
    if (paperFile) paper = lines(readFileSync(paperFile, "utf8")).map((q, i) => ({ id: `Q${i + 1}`, hash: sha(normalise(q)), ok: true }))
  } else {
    console.log(`nothing found for ${examId}`)
    process.exit(2)
  }

  const revealMs = reveals[0] ? await timeOf(reveals[0].createdAt) : undefined
  const deadline = revealMs === undefined ? opensAt : Math.min(opensAt, revealMs)
  console.log(`deadline ${new Date(deadline).toISOString()} (earlier of announced start and reveal)\n`)

  for (const w of witnesses) {
    const at = await timeOf(w.createdAt)
    const hashes = new Set(json(w)?.hashes ?? [])
    const hits = paper.filter((q) => q.ok && hashes.has(q.hash)).map((q) => q.id)
    const when = at < deadline ? "BEFORE" : "AFTER"
    const verdict = at >= deadline ? "too late" : !paper.length ? "waiting for paper" : hits.length ? `LEAK ${hits.join(", ")}` : "no match"
    console.log(`${w.key.slice(0, 12)}… ${w.creator.slice(0, 10)}… ${new Date(at).toISOString()} ${when}: ${verdict}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
