#!/usr/bin/env node
// Rebuilds every Mohar verdict for one exam straight from the public Arkiv RPC.
// Zero dependencies on purpose: copy this one file anywhere with Node 18+ and run it,
// even if the website and this repo are gone.
//
//   npx mohar-verify <exam-id> [issuer-address] [--domain exam-body.gov.in] [--paper paper.txt]
//   node verify.mjs <exam-id> ...   (same thing, from a copy of this file)
//
// --domain trusts whatever addresses the exam body lists at https://<domain>/.well-known/mohar.json.
// For an open exam (no issuer seal), pass the official paper as a text file, one question per line.

import { createHash } from "node:crypto"
import { readFileSync, realpathSync } from "node:fs"
import { pathToFileURL } from "node:url"

const RPC = process.env.ARKIV_RPC ?? "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
const DEFAULT_ISSUER = "0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6"

export const sha = (s) => "0x" + createHash("sha256").update(s, "utf8").digest("hex")
export const normalise = (t) =>
  t.normalize("NFKC").toLowerCase().replace(/^\s*(q(uestion)?\s*|प्रश्न\s*|प्र\.?\s*)?(no\.?\s*)?\(?[0-9०-९]{1,3}[).:।-]?\s+/u, "").replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim()
export const lines = (t) => t.split(/\r?\n/).map((l) => l.trim()).filter((l) => normalise(l))
const same = (a, b) => a?.toLowerCase() === b?.toLowerCase()

export async function domainIssuers(input) {
  const domain = input.trim().toLowerCase().slice(0, 300).replace(/^https?:\/\//, "").split(/[/?#]/, 1)[0].replace(/\.$/, "")
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(domain)) throw new Error(`not a valid domain: ${input}`)
  const res = await fetch(`https://${domain}/.well-known/mohar.json`, { redirect: "error" })
  if (!res.ok) throw new Error(`https://${domain}/.well-known/mohar.json returned HTTP ${res.status}`)
  const body = await res.json()
  const ok = typeof body?.name === "string" && Array.isArray(body.issuers) && body.issuers.length > 0 && body.issuers.every((a) => /^0x[0-9a-fA-F]{40}$/.test(a))
  if (!ok) throw new Error(`${domain}/.well-known/mohar.json needs {"name": "...", "issuers": ["0x..."]}`)
  return { domain, name: body.name, issuers: body.issuers }
}

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

// Every verdict for one exam, as data. The CLI prints it; the site's share cards use it too.
//   trusted: issuer addresses whose seals count; paperText: the official paper for an open exam
export async function verdicts(examId, { trusted = [DEFAULT_ISSUER], paperText } = {}) {
  const isTrusted = (a) => trusted.some((t) => same(a, t))
  const select = { key: true, creator: true, createdAt: true, attributes: true, payload: true }
  const records = []
  let cursor
  do {
    const r = await rpc("arkiv_query", [`project = str('mohar-v1') AND exam_id = str('${examId.replace(/'/g, "")}')`, { select, limit: "0xc8", ...(cursor && { cursor }) }])
    records.push(...r.data)
    cursor = r.cursor
  } while (cursor)

  const typed = (t) => records.filter((e) => attr(e, "type") === t)
  const commits = typed("paper_commit").filter((e) => isTrusted(e.creator))
  const forged = typed("paper_commit").filter((e) => !isTrusted(e.creator))
  const reveals = typed("reveal").filter((e) => isTrusted(e.creator))
  const entry = typed("open_exam").sort((a, b) => Number(BigInt(a.createdAt) - BigInt(b.createdAt)))[0]
  const witnesses = typed("witness")

  const blockMs = new Map()
  const timeOf = async (block) => {
    if (!blockMs.has(block)) blockMs.set(block, Number(BigInt((await rpc("eth_getBlockByNumber", [block, false])).timestamp)) * 1000)
    return blockMs.get(block)
  }

  let kind, title, opensAt, paper = []
  if (commits.length) {
    kind = "sealed"
    title = json(commits[0])?.title ?? examId
    opensAt = Number(BigInt(attr(commits[0], "opens_at_ms")))
    for (const r of reveals) {
      const p = json(r)
      const sealed = json(commits.find((c) => attr(c, "set_code") === attr(r, "set_code")))?.commits ?? []
      p.questions.forEach((q, i) => paper.push({ id: `${attr(r, "set_code")}-Q${i + 1}`, hash: sha(normalise(q)), ok: sealed[i] === sha(`${p.salts[i]}|${normalise(q)}`) }))
    }
  } else if (entry) {
    kind = "open"
    title = json(entry)?.title ?? examId
    opensAt = Number(BigInt(attr(entry, "opens_at_ms")))
    if (paperText) paper = lines(paperText).map((q, i) => ({ id: `Q${i + 1}`, hash: sha(normalise(q)), ok: true }))
  } else {
    return { kind: "none", examId }
  }

  // a big paper can be revealed over several transactions; the earliest one is when the paper was out
  const firstReveal = reveals.reduce((a, r) => (!a || BigInt(r.createdAt) < BigInt(a.createdAt) ? r : a), undefined)
  const revealMs = firstReveal ? await timeOf(firstReveal.createdAt) : undefined
  const deadline = revealMs === undefined ? opensAt : Math.min(opensAt, revealMs)

  const judged = []
  for (const w of witnesses) {
    const at = await timeOf(w.createdAt)
    const hashes = new Set(json(w)?.hashes ?? [])
    const hits = paper.filter((q) => q.ok && hashes.has(q.hash)).map((q) => q.id)
    const verdict = at >= deadline ? "late" : !paper.length ? "waiting" : hits.length ? "leak" : "no-match"
    judged.push({ key: w.key, creator: w.creator, at, before: at < deadline, total: hashes.size, hits, verdict })
  }
  return {
    kind, examId, title, opensAt, deadline,
    sets: commits.length, forged: forged.length, entryCreator: entry?.creator,
    paper: { total: paper.length, matching: paper.filter((q) => q.ok).length },
    witnesses: judged,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const paperAt = args.indexOf("--paper")
  const paperFile = paperAt >= 0 ? args.splice(paperAt, 2)[1] : undefined
  const domainAt = args.indexOf("--domain")
  const domainArg = domainAt >= 0 ? args.splice(domainAt, 2)[1] : undefined
  const [examId, issuerArg] = args
  if (!examId) {
    console.error("usage: mohar-verify <exam-id> [issuer-address] [--domain exam-body.gov.in] [--paper paper.txt]")
    process.exitCode = 1
    return
  }
  // names and set codes come from other people's files and the chain: drop terminal control codes before printing,
  // so nobody can recolour, overwrite or hide a line of the verdict
  const printable = (t) => String(t).replace(/[\u0000-\u001f\u007f-\u009f]/g, "?")
  let trusted = [issuerArg ?? DEFAULT_ISSUER]
  if (domainArg) {
    const proof = await domainIssuers(domainArg)
    trusted = proof.issuers
    console.log(`${proof.domain} vouches for ${proof.issuers.join(", ")} (${printable(proof.name)})`)
  }
  const v = await verdicts(examId, { trusted, paperText: paperFile ? readFileSync(paperFile, "utf8") : undefined })
  if (v.kind === "none") {
    console.log(`nothing found for ${examId}`)
    process.exitCode = 2
    return
  }
  if (v.kind === "sealed") {
    console.log(`sealed exam ${examId}: ${v.sets} set(s) by ${trusted.join(", ")}, ${v.forged} look-alike(s) from other wallets ignored`)
    if (v.paper.total) console.log(`paper revealed: ${v.paper.matching}/${v.paper.total} questions match the seal`)
  } else {
    console.log(`open exam ${examId}, added by ${v.entryCreator}`)
  }
  console.log(`deadline ${new Date(v.deadline).toISOString()} (earlier of announced start and reveal)
`)
  const words = { late: "too late", waiting: "waiting for paper", "no-match": "no match" }
  for (const w of v.witnesses) {
    const verdict = w.verdict === "leak" ? `LEAK ${printable(w.hits.join(", "))}` : words[w.verdict]
    console.log(`${w.key.slice(0, 12)}… ${w.creator.slice(0, 10)}… ${new Date(w.at).toISOString()} ${w.before ? "BEFORE" : "AFTER"}: ${verdict}`)
  }
}

// realpath: npx runs the file through a symlink in node_modules/.bin
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  // exitCode, not process.exit(): exiting with a fetch socket still open crashes node on windows
  await main().catch((e) => {
    console.error(`error: ${e.message}`)
    process.exitCode = 1
  })
}
