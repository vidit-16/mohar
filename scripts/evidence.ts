// Writes arkiv/evidence.json: every mohar-v1 record on Tiramisu with its creator, owner, flags,
// creation block and that block's timestamp, so anyone can spot-check the chain against the repo.
//   npm run evidence
import { writeFileSync } from "node:fs"
import { str } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import { blockTimeMs, ISSUERS, PROJECT, publicClient } from "../src/lib/mohar"

const reader = publicClient()
const head = await reader.getBlockNumber()
const { blockDuration } = await reader.getBlockTiming()

type Rec = Record<string, unknown>
const records: Rec[] = []
let cursor: string | undefined
do {
  let q = reader
    .select({ key: true, creator: true, owner: true, createdAt: true, expiresAt: true, creationFlags: true, attributes: true, payload: true })
    .where(eq("project", str(PROJECT)))
    .limit(200)
  if (cursor) q = q.cursor(cursor)
  const page = await q.fetch()
  for (const e of page.entities) {
    const attrs = Object.fromEntries(Object.entries(e.attributes ?? {}).map(([k, v]) => [k, String((v as { value: unknown }).value)]))
    let payload: unknown = null
    try {
      payload = e.toJson()
    } catch {}
    records.push({
      key: e.key,
      type: attrs.type,
      exam_id: attrs.exam_id,
      creator: e.creator,
      owner: e.owner,
      created_block: Number(e.createdAt),
      created_at: new Date(await blockTimeMs(reader, e.createdAt!)).toISOString(),
      expires_block: Number(e.expiresAt),
      expires_in_days: Number((((Number(e.expiresAt! - head) * Number(blockDuration)) / 86_400)).toFixed(1)),
      readonly: !!e.creationFlags?.readonly,
      permissionless_extension: !!e.creationFlags?.permissionlessExtension,
      attributes: attrs,
      payload,
    })
  }
  cursor = page.cursor
} while (cursor)

records.sort((a, b) => String(a.exam_id).localeCompare(String(b.exam_id)) || (a.created_block as number) - (b.created_block as number))

const exams = [...new Set(records.map((r) => r.exam_id as string))].map((id) => {
  const of = records.filter((r) => r.exam_id === id)
  const count = (t: string) => of.filter((r) => r.type === t).length
  return { exam_id: id, paper_commit: count("paper_commit"), reveal: count("reveal"), open_exam: count("open_exam"), witness: count("witness") }
})

const out = {
  network: "Arkiv Tiramisu testnet (chain 7738577)",
  rpc: "https://rpc.tiramisu.db-chain.testnet.arkiv.network",
  project: PROJECT,
  generated_at: new Date().toISOString(),
  at_block: Number(head),
  trusted_issuers: ISSUERS,
  how_to_check: "npx mohar-verify <exam_id>, or https://mohar-in.vercel.app/check.html?exam=<exam_id>",
  exams,
  records,
}
writeFileSync("arkiv/evidence.json", JSON.stringify(out, null, 2) + "\n")
console.log(`arkiv/evidence.json: ${records.length} records across ${exams.length} exams at block ${head}`)
