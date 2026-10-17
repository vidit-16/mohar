// Sends a share of the issuer's GLM to each witness wallet, so only one wallet needs the faucet.
import "dotenv/config"
import { createWalletClient, formatEther, type Hex, http, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { publicClient } from "../src/lib/mohar"

const share = parseEther(process.env.WITNESS_SHARE ?? "0.05")
const issuer = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(process.env.ISSUER_KEY as Hex) })
const reader = publicClient()
for (const name of ["WITNESS_A_KEY", "WITNESS_B_KEY"]) {
  const to = privateKeyToAccount(process.env[name] as Hex).address
  const hash = await issuer.sendTransaction({ to, value: share })
  await reader.waitForTransactionReceipt({ hash })
  console.log(`sent ${formatEther(share)} GLM to ${to} · ${hash}`)
}
