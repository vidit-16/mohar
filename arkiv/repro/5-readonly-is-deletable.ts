// friction #5: a readonly entity can still be deleted by its owner; there is no "undeletable" flag
import { ExpirationTime, stringToPayload } from "@arkiv-network/sdk"
import { versions, wallet } from "./_wallet"

console.log(versions)
const { entityKey } = await wallet.createEntity({ payload: stringToPayload("sealed?"), contentType: "text/plain", attributes: { project: "mohar-repro" }, expires: ExpirationTime.fromHours(1), flags: { readonly: true } })
console.log("created readonly entity", entityKey)
try {
  await wallet.patchEntity({ entityKey, payload: stringToPayload("edited"), contentType: "text/plain", attributes: { project: "mohar-repro" }, expires: ExpirationTime.fromHours(1) })
  console.log("patch: ALLOWED (unexpected)")
} catch (e) {
  console.log("patch: rejected, as expected:", (e as Error).message.split("\n")[0].slice(0, 100))
}
const { txHash } = await wallet.deleteEntity({ entityKey })
console.log("delete by owner: ALLOWED, tx", txHash)
