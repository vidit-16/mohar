// Sends test GLM from the issuer to any address: npm run send -- <address> [amount]
import "dotenv/config"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { createWalletClient, type Hex, http, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { publicClient } from "../src/lib/mohar"

const [to, amount = "0.05"] = process.argv.slice(2)
const issuer = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(process.env.ISSUER_KEY as Hex) })
const hash = await issuer.sendTransaction({ to: to as Hex, value: parseEther(amount) })
await publicClient().waitForTransactionReceipt({ hash })
console.log(`sent ${amount} GLM to ${to} · ${hash}`)
