// friction #6: EntityCreated events carry no attributes, so an app can't tell which creates are its own
import { createPublicClient, ExpirationTime, stringToPayload } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { webSocket } from "viem"
import { versions, wallet } from "./_wallet"

console.log(versions)
const live = createPublicClient({ chain: tiramisu, transport: webSocket() })
const seen = new Promise<unknown>((resolve) => {
  const stop = live.watchEntityEvents({ onEntityCreated: (ev) => { if (ev.owner.toLowerCase() === wallet.account!.address.toLowerCase()) { stop(); resolve(ev) } } })
})
await wallet.createEntity({ payload: stringToPayload("x"), contentType: "text/plain", attributes: { project: "mohar-repro", exam_id: "some-exam" }, expires: ExpirationTime.fromHours(1) })
const ev = (await seen) as Record<string, unknown>
console.log("event fields:", Object.keys(ev).join(", "))
console.log("has attributes / project / exam_id:", "attributes" in ev, "project" in ev, "exam_id" in ev)
process.exit(0)
