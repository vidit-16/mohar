import { useCallback, useEffect, useRef, useState } from "react"
import { burner } from "../lib/burner"
import { requestDrip } from "../lib/drip"
import { reader } from "./useChain"

export type DripState = "idle" | "dripping" | "failed"

// A fresh burner wallet asks /api/drip for a little test GLM once, so sealing is one click.
// If the drip isn't available (local dev, drained), the UI falls back to faucet instructions.
export function useBurnerBalance(active: boolean) {
  const address = burner().account!.address
  const [wei, setWei] = useState<bigint>()
  const [drip, setDrip] = useState<DripState>("idle")
  const tried = useRef(false)

  const refresh = useCallback(() => {
    reader.getBalance({ address }).then(setWei).catch(() => undefined)
  }, [address])

  useEffect(() => {
    if (!active) return
    refresh()
    const id = setInterval(refresh, drip === "dripping" ? 2000 : 10_000)
    return () => clearInterval(id)
  }, [active, refresh, drip])

  useEffect(() => {
    if (!active || wei !== 0n || tried.current) return
    tried.current = true
    setDrip("dripping")
    requestDrip(address).then((ok) => {
      if (!ok) return setDrip("failed")
      setTimeout(() => setDrip((d) => (d === "dripping" ? "failed" : d)), 30_000)
    })
  }, [active, wei, address])

  return { address, wei, refresh, drip: wei !== undefined && wei > 0n ? ("idle" as const) : drip }
}
