// friction #9: one atomic executeBatch can't hold a NEET-sized paper in all its languages,
// and the error when it's too big doesn't say "too big"
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk"
import { str } from "@arkiv-network/sdk/attr"
import { bytesToHex } from "viem"
import { versions, wallet } from "./_wallet"

console.log(versions)
const QUESTIONS = 180 // NEET-UG: 180 questions, set in 13 languages
// a realistic question with options is ~250 characters; Devanagari and other Indic scripts are 3 bytes per character in UTF-8
const question = (set: number, i: number) => `Q${i + 1}. [set ${set}] ${"Which of the following statements about the given organism is correct? (1) option one (2) option two (3) option three (4) option four ".slice(0, 230)}`
const salt = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)))

for (const sets of [1, 2, 4, 8, 13]) {
  const creates = Array.from({ length: sets }, (_, s) => ({
    payload: jsonToPayload({ v: 1, salts: Array.from({ length: QUESTIONS }, salt), questions: Array.from({ length: QUESTIONS }, (_, i) => question(s, i)) }),
    contentType: "application/json" as const,
    attributes: { project: str("mohar-repro"), type: str("reveal"), exam_id: str("size-test"), set_code: str(`L${s}`) },
    expires: ExpirationTime.fromHours(1),
  }))
  const bytes = creates.reduce((n, c) => n + c.payload.length, 0)
  try {
    const r = await wallet.executeBatch({ creates })
    console.log(`${String(sets).padStart(2)} language sets, ${Math.round(bytes / 1024)} KB of payload: OK, tx ${r.txHash}`)
  } catch (e) {
    const msg = (e as Error).message.split("\n").filter(Boolean).slice(0, 2).join(" | ")
    console.log(`${String(sets).padStart(2)} language sets, ${Math.round(bytes / 1024)} KB of payload: FAILED: ${msg.slice(0, 220)}`)
  }
}
process.exit(0)
