import type { Address } from "viem"
import { type Challenge, solve } from "./pow"

const STATIC = Boolean((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_STATIC)

// Asks for a puzzle, solves it (a second or two of CPU), then asks for the test GLM.
export async function requestDrip(address: Address): Promise<boolean> {
  if (STATIC) return false
  try {
    const got = await fetch(`/api/drip?address=${address}`, { cache: "no-store" })
    if (!got.ok) return false
    const challenge = (await got.json()) as Challenge
    const nonce = await solve(challenge)
    const res = await fetch("/api/drip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, challenge, nonce }) })
    return res.ok
  } catch {
    return false
  }
}
