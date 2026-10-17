// Reveal a sealed paper at the exam: npm run reveal -- secrets/<exam-id>.json
// Refuses to run before the announced start, because revealing early lets anyone "witness" the paper.
import "dotenv/config"
import { readFileSync } from "node:fs"
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { type Hex, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { revealExam, type SealSecrets } from "../src/lib/mohar"

const file = process.argv[2]
if (!file) throw new Error("usage: npm run reveal -- secrets/<exam-id>.json")
const secrets = JSON.parse(readFileSync(file, "utf8")) as SealSecrets & { opensAtMs: number }
const wait = secrets.opensAtMs - Date.now()
if (wait > 0) throw new Error(`exam ${secrets.examId} opens in ${Math.ceil(wait / 60000)} min; reveal at or after the start`)
const issuer = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(process.env.ISSUER_KEY as Hex) })
const res = await revealExam(issuer, secrets, secrets.opensAtMs)
console.log(`revealed ${secrets.sets.length} set(s) of ${secrets.examId} in one tx: ${res.txHash}`)
