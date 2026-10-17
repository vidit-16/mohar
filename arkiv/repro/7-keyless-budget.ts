// friction #7: the keyless query budget. Reads the budget headers from a few keyless queries.
// Doesn't drain your budget: it stops after 5 queries.
const RPC = "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
for (let i = 1; i <= 5; i++) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: i, method: "arkiv_query", params: ["project = str('mohar-v1') AND type = str('witness')", { select: { key: true }, limit: "0x1" }] }),
  })
  console.log(`query ${i}: HTTP ${res.status}, ratelimit="${res.headers.get("ratelimit")}", Arkiv-Cost=${res.headers.get("arkiv-cost")}, Arkiv-Quota-Used-Percent=${res.headers.get("arkiv-quota-used-percent")}${res.headers.get("retry-after") ? `, retry-after=${res.headers.get("retry-after")}` : ""}`)
}
console.log("eth_blockNumber is not budgeted:", (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "eth_blockNumber" }) })).json()).result)
