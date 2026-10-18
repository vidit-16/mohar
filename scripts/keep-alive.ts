// Keeps every Mohar record readable: anything expiring within MIN_DAYS gets topped up to about TARGET_DAYS.
// Records are created with permissionlessExtension, so any funded wallet can do this, not just the owner.
//   npm run keep-alive             (uses KEEPALIVE_KEY, or WITNESS_B_KEY locally)
//   npm run keep-alive -- --dry-run
import "dotenv/config"
import { createWalletClient } from "@arkiv-network/sdk"
import { str } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { eq } from "@arkiv-network/sdk/query"
import { formatEther, type Hex, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { keepAlive, PROJECT, publicClient, RPC_URL } from "../src/lib/mohar"
import { dueForTopUp, type Upkeep } from "./upkeep"

const MIN_DAYS = 21
const TARGET_DAYS = 35
const dryRun = process.argv.includes("--dry-run")

const key = (process.env.KEEPALIVE_KEY || process.env.WITNESS_B_KEY) as Hex | undefined
if (!key && !dryRun) throw new Error("set KEEPALIVE_KEY to a funded Tiramisu key")

const reader = publicClient()
const head = await reader.getBlockNumber()
const { blockDuration } = await reader.getBlockTiming()

const rows: Upkeep[] = []
let cursor: string | undefined
do {
  let q = reader.select({ key: true, expiresAt: true, attributes: true, creationFlags: true }).where(eq("project", str(PROJECT))).limit(200)
  if (cursor) q = q.cursor(cursor)
  const page = await q.fetch()
  for (const e of page.entities) {
    const attrs = Object.fromEntries(Object.entries(e.attributes ?? {}).map(([k, v]) => [k, String((v as { value: unknown }).value)]))
    rows.push({ key: e.key!, expiresAt: e.expiresAt!, label: `${attrs.exam_id} ${attrs.type}`, extendable: !!e.creationFlags?.permissionlessExtension })
  }
  cursor = page.cursor
} while (cursor)

const { extend, skipped } = dueForTopUp(rows, head, Number(blockDuration), MIN_DAYS, TARGET_DAYS)
console.log(`${rows.length} records, ${extend.length + skipped.length} expire within ${MIN_DAYS} days (block ${head})`)
for (const r of skipped) console.log(`${r.label.padEnd(48)} ${r.left.toFixed(1).padStart(5)}d left  skipped: ${r.left <= 0 ? "already expired" : "not extendable"}`)

const wallet = key && createWalletClient({ chain: tiramisu, transport: http(RPC_URL, { retryCount: 0 }), account: privateKeyToAccount(key) })
if (wallet) console.log(`wallet ${wallet.account!.address}, ${formatEther(await reader.getBalance({ address: wallet.account!.address }))} GLM`)

let failed = 0
for (const r of extend) {
  const line = `${r.label.padEnd(48)} ${r.left.toFixed(1).padStart(5)}d left, +${r.add}d`
  if (dryRun || !wallet) { console.log(`${line}  (dry run)`); continue }
  try {
    const { txHash } = await keepAlive(wallet, r.key as Hex, r.expiresAt, r.add)
    console.log(`${line}  ${txHash}`)
  } catch (e) {
    failed++
    console.log(`${line}  FAILED: ${(e as Error).message.split("\n")[0]}`)
  }
}
if (failed) process.exit(1)
