import { useCallback, useEffect, useState } from "react"
import { keep, kept } from "../lib/keep"
import { publicClient } from "../lib/mohar"

export const reader = publicClient()

type Clock = { block: bigint; at: number; secs: number }

// the block this browser last saw, carried forward at the chain's block time, so the number is there at first paint
// instead of popping in when the first answer arrives; the real block replaces it within a moment
function remembered(): Clock | undefined {
  const c = kept<Clock>("clock")
  if (!c || Date.now() - c.at > 86_400_000) return undefined
  return { block: c.block + BigInt(Math.max(0, Math.floor((Date.now() - c.at) / (c.secs * 1000)))), at: Date.now(), secs: c.secs }
}

export function useChain() {
  const [clock, setClock] = useState<Clock | undefined>(remembered)
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
          const c = { block, at: Date.now(), secs }
          setClock(c)
          keep("clock", c)
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
