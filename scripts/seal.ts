// Seal a question paper from a CSV.
//   npm run seal -- paper.csv --exam-id UPPSC-PRE-2026-S1 --title "UPPSC Prelims 2026, Shift 1" --opens 2026-11-02T09:30+05:30 [--shift 1]
// CSV: header "set,question", one row per question, in paper order. Bilingual papers: give each
// language its own set code (A-en, A-hi) so a leak in either language matches.
// Writes the salts to secrets/<exam-id>.json. Keep that file offline until the exam starts; without it
// the seal can never be opened.
import "dotenv/config"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { type Hex, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { parsePaperCsv } from "../src/lib/csv"
import { sealExam } from "../src/lib/mohar"

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const file = args[0]
const examId = flag("exam-id")
const title = flag("title")
const opensRaw = flag("opens")
if (!file || !examId || !title || !opensRaw) {
  console.error('usage: npm run seal -- paper.csv --exam-id ID --title "Title" --opens 2026-11-02T09:30+05:30 [--shift 1]')
  process.exit(1)
}
const opensAtMs = opensRaw.startsWith("+") ? Date.now() + Number(opensRaw.slice(1, -1)) * (opensRaw.endsWith("h") ? 3_600_000 : 60_000) : Date.parse(opensRaw)
if (!Number.isFinite(opensAtMs) || opensAtMs <= Date.now()) throw new Error("--opens must be a future time, e.g. 2026-11-02T09:30+05:30 or +10m")
if (!/^[A-Za-z0-9._-]{3,100}$/.test(examId)) throw new Error("--exam-id: letters, digits, . _ - only")
if (existsSync(`secrets/${examId}.json`)) throw new Error(`secrets/${examId}.json already exists; this exam was sealed before`)

const sets = parsePaperCsv(readFileSync(file, "utf8"))
const key = process.env.ISSUER_KEY as Hex
if (!key) throw new Error("ISSUER_KEY missing from .env")
const issuer = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(key) })
console.log(`sealing ${examId}: ${sets.map((s) => `${s.code} (${s.questions.length})`).join(", ")}, opens ${new Date(opensAtMs).toISOString()}, issuer ${issuer.account!.address}`)
const sealed = await sealExam(issuer, { examId, title, shift: Number(flag("shift") ?? 1), opensAtMs, sets })
mkdirSync("secrets", { recursive: true })
writeFileSync(`secrets/${examId}.json`, JSON.stringify({ ...sealed.secrets, opensAtMs }, null, 2))
console.log(`sealed in tx ${sealed.txHash}\nsalts saved to secrets/${examId}.json (keep offline until the exam starts)`)
