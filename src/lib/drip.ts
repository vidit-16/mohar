import type { Address } from "viem"

export async function requestDrip(address: Address): Promise<boolean> {
  try {
    const res = await fetch("/api/drip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) })
    return res.ok
  } catch {
    return false
  }
}
