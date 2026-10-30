import { useCallback, useEffect, useState } from "react"
import { publicClient } from "../lib/mohar"

export const reader = publicClient()

type Clock = { block: bigint; at: number; secs: number }

export function useChain() {
  const [clock, setClock] = useState<Clock>()
  const [online, setOnline] = useState<boolean>()
  useEffect(() => {
    let stop = false
    let secs = 2
    reader
      .getBlockTiming()
      .then((t) => (secs = t.blockDuration))
      .catch(() => undefined)
    const tick = () =>
      reader
        .getBlockNumber()
        .then((block) => {
          if (stop) return
          setClock({ block, at: Date.now(), secs })
          setOnline(true)
        })
        .catch(() => !stop && setOnline(false))
    tick()
    const id = setInterval(tick, 15_000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])
  const msUntilBlock = useCallback(
    (block: bigint) => (clock ? Number(block - clock.block) * clock.secs * 1000 - (Date.now() - clock.at) : NaN),
    [clock],
  )
  return { block: clock?.block, online, msUntilBlock, clock }
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
