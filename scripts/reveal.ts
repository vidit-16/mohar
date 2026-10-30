// Reveal a sealed paper at the exam: npm run reveal -- secrets/<exam-id>.json
// Refuses to run before the announced start, because revealing early lets anyone "witness" the paper.
import "dotenv/config"
import { readFileSync } from "node:fs"
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { type Hex, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { commitsFor, publicClient, revealExam, sameAddr, type SealSecrets } from "../src/lib/mohar"

const file = process.argv[2]
if (!file) throw new Error("usage: npm run reveal -- secrets/<exam-id>.json")
const secrets = JSON.parse(readFileSync(file, "utf8")) as SealSecrets & { opensAtMs?: number }
const issuer = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(process.env.ISSUER_KEY as Hex) })
// salts files written before the start time was saved in them: read it back from the issuer's own seal
const opensAtMs =
  secrets.opensAtMs ??
  Number((await commitsFor(publicClient(), secrets.examId)).find((r) => sameAddr(r.creator, issuer.account!.address))?.attrs.opens_at_ms)
if (!Number.isFinite(opensAtMs)) throw new Error(`no start time for ${secrets.examId} in ${file} or on chain from this issuer`)
const wait = opensAtMs - Date.now()
if (wait > 0) throw new Error(`exam ${secrets.examId} opens in ${Math.ceil(wait / 60000)} min; reveal at or after the start`)
const res = await revealExam(issuer, secrets, opensAtMs)
console.log(`revealed ${secrets.sets.length} set(s) of ${secrets.examId} in one tx: ${res.txHash}`)
