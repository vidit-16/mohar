// Prints the GLM balance of each demo wallet.
import "dotenv/config"
import { formatEther, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { publicClient } from "../src/lib/mohar"

const reader = publicClient()
for (const name of ["ISSUER_KEY", "WITNESS_A_KEY", "WITNESS_B_KEY"]) {
  const address = privateKeyToAccount(process.env[name] as Hex).address
  console.log(name.replace("_KEY", "").padEnd(10), address, formatEther(await reader.getBalance({ address })), "GLM")
}
