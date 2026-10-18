// Gives a brand-new witness wallet just enough test GLM to seal, so nobody has to visit a faucet first.
// Paid from a separate drip wallet with a small balance; only empty, never-used wallets get topped up,
// and only after the browser solves a small proof of work tied to that wallet (see src/lib/pow.ts).
//   GET  /api/drip?address=0x…              → a signed puzzle
//   POST /api/drip {address, challenge, nonce} → funds the wallet if the puzzle is solved
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { createPublicClient, createWalletClient, http, isAddress, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { type Challenge, solves } from "../src/lib/pow.js"

const AMOUNT = parseEther("0.02")
const PER_IP_PER_HOUR = 5
const POW_BITS = 17
const CHALLENGE_TTL_MS = 5 * 60_000
const hits = new Map<string, number[]>()

function limited(ip: string) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000)
  if (recent.length >= PER_IP_PER_HOUR) return true
  hits.set(ip, [...recent, now])
  return false
}

const dripKey = () => process.env.DRIP_KEY?.trim() as `0x${string}` | undefined
// the signing secret is derived from the drip key, so there's no second secret to manage
const sign = (key: string, c: Omit<Challenge, "sig">) =>
  ("0x" + createHmac("sha256", `mohar-drip-pow|${key}`).update(`${c.address.toLowerCase()}|${c.salt}|${c.exp}|${c.bits}`).digest("hex")) as `0x${string}`

function validChallenge(key: string, c: unknown, address: string): c is Challenge {
  if (!c || typeof c !== "object") return false
  const { salt, exp, bits, sig } = c as Challenge
  if (typeof salt !== "string" || !/^0x[0-9a-f]{32}$/.test(salt) || typeof sig !== "string" || !/^0x[0-9a-f]{64}$/.test(sig)) return false
  if (!Number.isSafeInteger(exp) || exp < Date.now() || exp > Date.now() + CHALLENGE_TTL_MS || bits !== POW_BITS) return false
  const want = Buffer.from(sign(key, { address, salt, exp, bits }).slice(2), "hex")
  return timingSafeEqual(want, Buffer.from(sig.slice(2), "hex"))
}

export async function GET(req: Request) {
  const key = dripKey()
  if (!key) return Response.json({ error: "drip is not configured" }, { status: 503 })
  const address = new URL(req.url).searchParams.get("address")
  if (!address || !isAddress(address)) return Response.json({ error: "bad address" }, { status: 400 })
  const c = { address: address.toLowerCase(), salt: `0x${randomBytes(16).toString("hex")}` as `0x${string}`, exp: Date.now() + CHALLENGE_TTL_MS, bits: POW_BITS }
  return Response.json({ ...c, sig: sign(key, c) }, { headers: { "cache-control": "no-store" } })
}

export async function POST(req: Request) {
  const key = dripKey()
  if (!key) return Response.json({ error: "drip is not configured" }, { status: 503 })
  let body: { address?: unknown; challenge?: unknown; nonce?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 })
  }
  const { address, challenge, nonce } = body ?? {}
  if (typeof address !== "string" || !isAddress(address)) return Response.json({ error: "bad address" }, { status: 400 })
  if (!validChallenge(key, challenge, address.toLowerCase())) return Response.json({ error: "missing, expired or forged puzzle; ask GET /api/drip again" }, { status: 403 })
  if (typeof nonce !== "number" || !solves(challenge, nonce)) return Response.json({ error: "puzzle not solved" }, { status: 403 })
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (limited(ip)) return Response.json({ error: "too many requests, try again in an hour" }, { status: 429 })

  const upstream = process.env.ARKIV_KEY ? `https://rpc.tiramisu.db-chain.testnet.arkiv.network/${process.env.ARKIV_KEY.trim()}` : undefined
  const reader = createPublicClient({ chain: tiramisu, transport: http(upstream) })
  const [balance, txCount] = await Promise.all([reader.getBalance({ address }), reader.getTransactionCount({ address })])
  if (balance > 0n || txCount > 0) return Response.json({ error: "this wallet already has funds or history" }, { status: 409 })

  const wallet = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(key) })
  const hash = await wallet.sendTransaction({ to: address, value: AMOUNT })
  return Response.json({ hash, amount: "0.02" })
}
