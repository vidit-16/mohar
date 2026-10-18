import { useCallback, useEffect, useRef, useState } from "react"
import { burner, type BurnerKind } from "../lib/burner"
import { requestDrip } from "../lib/drip"
import { reader } from "./useChain"

export type DripState = "idle" | "dripping" | "failed"

// A fresh burner wallet asks /api/drip for a little test GLM once, so sealing is one click.
// If the drip isn't available (local dev, drained), the UI falls back to faucet instructions.
// Balance and drip state are tagged with the address they belong to, so a retired witness wallet's
// numbers never show for the new one.
export function useBurnerBalance(active: boolean, kind: BurnerKind = "main") {
  const address = burner(kind).account!.address
  const [balance, setBalance] = useState<{ of: string; wei: bigint }>()
  const [dripFor, setDripFor] = useState<{ of: string; state: DripState }>()
  const wei = balance?.of === address ? balance.wei : undefined
  const drip = dripFor?.of === address ? dripFor.state : "idle"
  const tried = useRef<string>(undefined)

  const refresh = useCallback(() => {
    reader
      .getBalance({ address })
      .then((v) => setBalance({ of: address, wei: v }))
      .catch(() => undefined)
  }, [address])

  useEffect(() => {
    if (!active) return
    refresh()
    const id = setInterval(refresh, drip === "dripping" ? 2000 : 10_000)
    return () => clearInterval(id)
  }, [active, refresh, drip])

  useEffect(() => {
    if (!active || wei !== 0n || tried.current === address) return
    tried.current = address
    setDripFor({ of: address, state: "dripping" })
    requestDrip(address).then((ok) => {
      if (!ok) return setDripFor({ of: address, state: "failed" })
      setTimeout(() => setDripFor((d) => (d?.of === address && d.state === "dripping" ? { of: address, state: "failed" } : d)), 30_000)
    })
  }, [active, wei, address])

  return { address, wei, refresh, drip: wei !== undefined && wei > 0n ? ("idle" as const) : drip }
}
