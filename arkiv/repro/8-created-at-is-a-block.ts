// friction #8: entities say when they were created only as a block number, so "was this before 09:30?" costs a block read per row
import { str } from "@arkiv-network/sdk/attr"
import { and, eq } from "@arkiv-network/sdk/query"
import { reader, versions } from "./_wallet"

console.log(versions)
const exam = process.argv[2] ?? "DSPSC-PRE26-10170937"
const { entities } = await reader
  .select({ key: true, createdAt: true })
  .where(and([eq("project", str("mohar-v1")), eq("exam_id", str(exam))]))
  .limit(200)
  .fetch()

const blocks = [...new Set(entities.map((e) => e.createdAt!))]
console.log(`exam ${exam}: ${entities.length} entities in 1 query, createdAt is a ${typeof entities[0]?.createdAt} block number (${entities[0]?.createdAt})`)

const raw = await reader.request({ method: "arkiv_getEntity" as never, params: [entities[0]!.key] as never }).catch((e: Error) => ({ error: e.message.split("\n")[0] }))
const r = raw as Record<string, unknown>
console.log("raw arkiv_getEntity fields:", Object.keys(r).join(", "), "| createdAt:", r.createdAt, "updatedAt:", r.updatedAt)

const t0 = Date.now()
for (const b of blocks) await reader.getBlock({ blockNumber: b })
console.log(`to turn them into times: ${blocks.length} extra eth_getBlockByNumber calls, ${Date.now() - t0} ms`)

const { blockDuration } = await reader.getBlockTiming()
console.log(`getBlockTiming only describes the current block (blockDuration ${blockDuration}s), so estimating past times from it drifts`)
process.exit(0)
