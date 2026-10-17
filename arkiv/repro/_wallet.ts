import "dotenv/config"
import { createPublicClient, createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { type Hex, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"

// repros sign with witness A from `npm run wallets`; reads use ARKIV_KEY if set
const key = process.env.WITNESS_A_KEY as Hex
if (!key) throw new Error("run `npm run wallets` and fund WITNESS_A first")
const rpc = process.env.ARKIV_KEY ? `${tiramisu.rpcUrls.default.http[0]}/${process.env.ARKIV_KEY.trim()}` : undefined
export const wallet = createWalletClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0 }), account: privateKeyToAccount(key) })
export const reader = createPublicClient({ chain: tiramisu, transport: http(rpc, { retryCount: 0 }) })
export const versions = `@arkiv-network/sdk ${(await import("@arkiv-network/sdk/package.json", { with: { type: "json" } })).default.version}, node ${process.version}`
