import { createWalletClient, type WalletArkivClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { type Hex, http } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

// Two throwaway wallets live in the browser:
// - "main" stays the same: an issuer's address must never change, and it adds open exams and keeps records alive.
// - "witness" is retired after every seal, so the next witness comes from a brand-new wallet funded by the
//   shared drip. On chain, one person's witnesses then can't be tied to each other or to their main wallet.
export type BurnerKind = "main" | "witness"
const STORE: Record<BurnerKind, string> = { main: "mohar.burner", witness: "mohar.witness" }
const RETIRED = "mohar.witness.used"

function loadKey(kind: BurnerKind): Hex {
  try {
    const saved = localStorage.getItem(STORE[kind])
    if (saved && /^0x[0-9a-f]{64}$/i.test(saved)) return saved as Hex
    const fresh = generatePrivateKey()
    localStorage.setItem(STORE[kind], fresh)
    return fresh
  } catch {
    return generatePrivateKey()
  }
}

const cached: Partial<Record<BurnerKind, WalletArkivClient>> = {}
export function burner(kind: BurnerKind = "main"): WalletArkivClient {
  cached[kind] ??= createWalletClient({
    chain: tiramisu,
    transport: http(undefined, { retryCount: 0 }),
    account: privateKeyToAccount(loadKey(kind)),
  })
  return cached[kind]
}

// Keeps the retired key (so the witness can still be extended or deleted from this browser) and starts a new one.
export function retireWitnessWallet() {
  try {
    const key = localStorage.getItem(STORE.witness)
    if (key) {
      const used = JSON.parse(localStorage.getItem(RETIRED) ?? "[]") as string[]
      localStorage.setItem(RETIRED, JSON.stringify([key, ...used].slice(0, 50)))
    }
    localStorage.removeItem(STORE.witness)
  } catch {
    /* storage blocked: the next load makes a fresh key anyway */
  }
  delete cached.witness
}

export function resetBurner() {
  try {
    localStorage.removeItem(STORE.main)
  } catch {
    /* nothing stored */
  }
  delete cached.main
}
