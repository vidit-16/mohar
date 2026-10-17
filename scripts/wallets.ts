// Creates the demo wallets in .env (never printed) and shows their addresses.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const ROLES = ["ISSUER_KEY", "WITNESS_A_KEY", "WITNESS_B_KEY"] as const
const env = existsSync(".env") ? readFileSync(".env", "utf8") : ""
let out = env
for (const role of ROLES) {
  if (!new RegExp(`^${role}=`, "m").test(out)) out += `${role}=${generatePrivateKey()}\n`
}
if (out !== env) writeFileSync(".env", out)
for (const role of ROLES) {
  const key = out.match(new RegExp(`^${role}=(0x[0-9a-fA-F]{64})`, "m"))![1] as `0x${string}`
  console.log(role.replace("_KEY", "").padEnd(10), privateKeyToAccount(key).address)
}
