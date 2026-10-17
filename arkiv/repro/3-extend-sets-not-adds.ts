// friction #3: extendEntity({ expires: fromDays(n) }) means "n days from now", not "add n days"
import { ExpirationTime, stringToPayload } from "@arkiv-network/sdk"
import { reader, versions, wallet } from "./_wallet"

console.log(versions)
const { entityKey, expiresAt: before } = await wallet.createEntity({ payload: stringToPayload("repro"), contentType: "text/plain", attributes: { project: "mohar-repro" }, expires: ExpirationTime.fromDays(14) })
console.log("created", entityKey, "expiresAt", before)
const { expiresAt: after } = await wallet.extendEntity({ entityKey, expires: ExpirationTime.fromDays(14) })
const { blockDuration } = await reader.getBlockTiming()
console.log("extended with fromDays(14), expiresAt", after)
console.log(`gained ${after - before} blocks = ${(Number(after - before) * blockDuration / 60).toFixed(1)} minutes (expected ~14 days = ${14 * 86400 / blockDuration} blocks)`)
