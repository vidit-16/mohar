// Creates the demo wallets in .env (never printed) and shows their addresses.
import { closeSync, openSync, readFileSync, writeSync } from "node:fs"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const ROLES = ["ISSUER_KEY", "WITNESS_A_KEY", "WITNESS_B_KEY"] as const
// one handle in append mode: creates .env if it's missing, and nothing can swap the file between the read and the write
const fd = openSync(".env", "a+")
const env = readFileSync(fd, "utf8")
let add = ""
for (const role of ROLES) {
  if (!new RegExp(`^${role}=`, "m").test(env)) add += `${role}=${generatePrivateKey()}\n`
}
if (add) writeSync(fd, (env && !env.endsWith("\n") ? "\n" : "") + add)
closeSync(fd)
const all = env + add
for (const role of ROLES) {
  const key = all.match(new RegExp(`^${role}=(0x[0-9a-fA-F]{64})`, "m"))![1] as `0x${string}`
  console.log(role.replace("_KEY", "").padEnd(10), privateKeyToAccount(key).address)
}
