import { DAY_MS } from "../lib/mohar"

export const EXPLORER = "https://tiramisu.explorer.arkiv.network"
export const RPC = "https://rpc.tiramisu.db-chain.testnet.arkiv.network"
export const REPO = "https://github.com/vidit-16/mohar"
export const FAUCET = "https://hub.arkiv.network/faucet"

export const short = (a: string, head = 6, tail = 4) => `${a.slice(0, head)}…${a.slice(-tail)}`

const IST = "Asia/Kolkata"
export const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: IST }) + " IST"
// for lists, where the second an exam starts is noise
export const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: IST }) + " IST"
// a time of day the way people say it: 3:08 pm
export const fmtClock = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST })
// the first demo exam was sealed with "(upcoming)" in its on-chain title, which reads wrong once it has started
export const shownTitle = (title: string, started: boolean) => (started ? title.replace(/\s*\(upcoming\)$/i, "") : title)
export const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: IST })
export const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST })

export function fmtDuration(ms: number): string {
  const abs = Math.abs(ms)
  if (abs < 60_000) return `${Math.max(1, Math.round(abs / 1000))}s`
  const d = Math.floor(abs / DAY_MS)
  const h = Math.floor((abs % DAY_MS) / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

export const fmtRelative = (ms: number, now = Date.now()) =>
  ms > now ? `in ${fmtDuration(ms - now)}` : `${fmtDuration(now - ms)} ago`

export const errText = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e)
  if (/insufficient funds|exceeds balance/i.test(msg)) return "This wallet has no test GLM yet. Top it up from the faucet and try again."
  if (/429|ANON_COST_LIMITED|rate/i.test(msg)) return "Arkiv's public read limit was reached. Wait a minute and retry."
  return msg.split("\n")[0].slice(0, 220)
}
