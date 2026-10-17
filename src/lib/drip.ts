import type { Address } from "viem"

const STATIC = Boolean((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_STATIC)

export async function requestDrip(address: Address): Promise<boolean> {
  if (STATIC) return false
  try {
    const res = await fetch("/api/drip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) })
    return res.ok
  } catch {
    return false
  }
}
