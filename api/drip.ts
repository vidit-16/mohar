// Gives a brand-new witness wallet just enough test GLM to seal, so nobody has to visit a faucet first.
// Paid from a separate drip wallet with a small balance; only empty, never-used wallets get topped up.
import { createPublicClient, createWalletClient, http, isAddress, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { tiramisu } from "@arkiv-network/sdk/chains"

const AMOUNT = parseEther("0.02")
const PER_IP_PER_HOUR = 5
const hits = new Map<string, number[]>()

function limited(ip: string) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000)
  if (recent.length >= PER_IP_PER_HOUR) return true
  hits.set(ip, [...recent, now])
  return false
}

export async function POST(req: Request) {
  const key = process.env.DRIP_KEY?.trim() as `0x${string}` | undefined
  if (!key) return Response.json({ error: "drip is not configured" }, { status: 503 })
  let address: unknown
  try {
    ;({ address } = await req.json())
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 })
  }
  if (typeof address !== "string" || !isAddress(address)) return Response.json({ error: "bad address" }, { status: 400 })
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (limited(ip)) return Response.json({ error: "too many requests, try again in an hour" }, { status: 429 })

  const upstream = process.env.ARKIV_KEY ? `https://rpc.tiramisu.db-chain.testnet.arkiv.network/${process.env.ARKIV_KEY.trim()}` : undefined
  const reader = createPublicClient({ chain: tiramisu, transport: http(upstream) })
  const [balance, nonce] = await Promise.all([reader.getBalance({ address }), reader.getTransactionCount({ address })])
  if (balance > 0n || nonce > 0) return Response.json({ error: "this wallet already has funds or history" }, { status: 409 })

  const wallet = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(key) })
  const hash = await wallet.sendTransaction({ to: address, value: AMOUNT })
  return Response.json({ hash, amount: "0.02" })
}
