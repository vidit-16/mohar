#!/usr/bin/env node
// The smallest possible Mohar reader: how many people sealed a witness for an exam, and when.
//   node examples/witness-count.mjs DSPSC-PRE26-10170937

const RPC = process.env.ARKIV_RPC ?? "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
const examId = process.argv[2]
if (!examId) throw new Error("usage: node examples/witness-count.mjs <exam-id>")

const call = async (method, params) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result

const { data } = await call("arkiv_query", [`project = str('mohar-v1') AND type = str('witness') AND exam_id = str('${examId}')`, { select: { creator: true, createdAt: true }, limit: "0xc8" }])
console.log(`${data.length} witness(es) for ${examId}`)
for (const w of data) {
  const block = await call("eth_getBlockByNumber", [w.createdAt, false])
  console.log(`  ${new Date(Number(BigInt(block.timestamp)) * 1000).toISOString()}  ${w.creator}`)
}
