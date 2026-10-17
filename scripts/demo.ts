// npm run demo               seal -> witness -> fake seal -> exam opens -> reveal -> late witness -> verify
// npm run demo -- --upcoming  only seal an exam 9 days out, so the witness form has something to use
import "dotenv/config"
import { mkdirSync, writeFileSync } from "node:fs"
import { createWalletClient, type WalletArkivClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import {
  blockTimeMs,
  commitsFor,
  DAY_MS,
  deadlineOf,
  groupExams,
  judge,
  openReveals,
  publicClient,
  revealExam,
  revealsFor,
  sealExam,
  witnessesFor,
  witnessPaper,
} from "../src/lib/mohar"
import { LATE_B, LEAK_A, SETS } from "./paper"

const EXPLORER = "https://tiramisu.explorer.arkiv.network"
const wallet = (name: string): WalletArkivClient => {
  const key = process.env[name] as Hex | undefined
  if (!key) throw new Error(`${name} missing from .env — run npm run wallets`)
  return createWalletClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0 }), account: privateKeyToAccount(key) })
}
const log = (step: string, msg: string) => console.log(`\n[${new Date().toISOString().slice(11, 19)}] ${step}\n  ${msg}`)
const tx = (h: string) => `${EXPLORER}/tx/${h}`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const issuer = wallet("ISSUER_KEY")
const witnessA = wallet("WITNESS_A_KEY")
const witnessB = wallet("WITNESS_B_KEY")
const reader = publicClient()
const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "")
mkdirSync("secrets", { recursive: true })

if (process.argv.includes("--upcoming")) {
  const opensAtMs = Date.now() + 9 * DAY_MS
  const spec = { examId: `DSPSC-PRE26-U${stamp}`, title: "Demo State PSC Prelims 2026 (upcoming)", shift: 1, opensAtMs, sets: SETS }
  const sealed = await sealExam(issuer, spec)
  writeFileSync(`secrets/${spec.examId}.json`, JSON.stringify(sealed.secrets, null, 2))
  log("SEAL (upcoming)", `${spec.examId} opens ${new Date(opensAtMs).toISOString()}\n  ${tx(sealed.txHash)}`)
  process.exit(0)
}

const opensInMin = Number(process.env.OPENS_IN_MIN ?? 3)
const opensAtMs = Date.now() + opensInMin * 60_000
const spec = { examId: `DSPSC-PRE26-${stamp}`, title: "Demo State PSC Prelims 2026, Shift 1", shift: 1, opensAtMs, sets: SETS }

const sealed = await sealExam(issuer, spec)
writeFileSync(`secrets/${spec.examId}.json`, JSON.stringify(sealed.secrets, null, 2))
log("1 SEAL", `issuer ${issuer.account!.address} sealed ${spec.sets.length} sets of ${spec.examId}\n  keys ${sealed.createdEntities.join(", ")}\n  ${tx(sealed.txHash)}`)

const wA = await witnessPaper(witnessA, spec.examId, LEAK_A)
log("2 WITNESS (before)", `witness A sealed 4 question hashes, key ${wA.entityKey}\n  ${tx(wA.txHash)}`)

const forged = await sealExam(witnessB, { ...spec, sets: [{ code: "A", questions: ["This is not the real paper"] }] })
log("3 FORGED SEAL", `wallet ${witnessB.account!.address} wrote a look-alike commit\n  ${tx(forged.txHash)}`)

const wait = opensAtMs - Date.now() + 4_000
if (wait > 0) {
  log("… waiting", `${Math.round(wait / 1000)} s until the exam opens`)
  await sleep(wait)
}
const rev = await revealExam(issuer, sealed.secrets, opensAtMs)
log("4 REVEAL", `all ${rev.createdEntities.length} sets revealed in one transaction\n  ${tx(rev.txHash)}`)

const wB = await witnessPaper(witnessB, spec.examId, LATE_B)
log("5 WITNESS (after)", `witness B sealed 1 hash after the exam opened, key ${wB.entityKey}\n  ${tx(wB.txHash)}`)

const issuerAddr = issuer.account!.address
const [exam] = groupExams(await commitsFor(reader, spec.examId), issuerAddr)
const reveals = await revealsFor(reader, spec.examId, issuerAddr)
const revealed = openReveals(exam.sets, reveals)
const deadline = deadlineOf(exam.opensAtMs, await blockTimeMs(reader, reveals[0].createdAt))
const { rows } = await witnessesFor(reader, spec.examId)
log("6 VERIFY", `${exam.sets.length} trusted sets, ${exam.forged.length} forged look-alike(s) ignored, ${revealed.filter((q) => q.sealed).length}/${revealed.length} revealed questions match their seal`)
for (const w of rows) {
  const v = judge(w, await blockTimeMs(reader, w.createdAt), deadline, revealed)
  const total = (w.json as { hashes: string[] }).hashes.length
  console.log(
    `  witness ${w.key.slice(0, 10)}… by ${w.creator.slice(0, 8)}… at block ${w.createdAt}: ` +
      `${v.before ? "BEFORE" : "AFTER"} the exam, ${v.matches.length}/${total} match official ` +
      v.matches.map((m) => `${m.set}-Q${m.index}`).join(", "),
  )
}
console.log(`\nOpen the site with ?exam=${spec.examId}`)
