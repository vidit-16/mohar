import { useCallback, useEffect, useState } from "react"
import { burner } from "../lib/burner"
import { reader } from "./useChain"

export function useBurnerBalance(active: boolean) {
  const address = burner().account!.address
  const [wei, setWei] = useState<bigint>()
  const refresh = useCallback(() => {
    reader.getBalance({ address }).then(setWei).catch(() => undefined)
  }, [address])
  useEffect(() => {
    if (!active) return
    refresh()
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [active, refresh])
  return { address, wei, refresh }
}
