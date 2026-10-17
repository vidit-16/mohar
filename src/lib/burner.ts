import { createWalletClient, type WalletArkivClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { type Hex, http } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const STORE = "mohar.burner"

function loadKey(): Hex {
  try {
    const saved = localStorage.getItem(STORE)
    if (saved && /^0x[0-9a-f]{64}$/i.test(saved)) return saved as Hex
    const fresh = generatePrivateKey()
    localStorage.setItem(STORE, fresh)
    return fresh
  } catch {
    return generatePrivateKey()
  }
}

let cached: WalletArkivClient | undefined
export function burner(): WalletArkivClient {
  cached ??= createWalletClient({
    chain: tiramisu,
    transport: http(undefined, { retryCount: 0 }),
    account: privateKeyToAccount(loadKey()),
  })
  return cached
}

export function resetBurner() {
  try {
    localStorage.removeItem(STORE)
  } catch {
    /* nothing stored */
  }
  cached = undefined
}
