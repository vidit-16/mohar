// What this browser last saw, kept between visits so a page it has opened before draws at once and then refreshes.
// Records on Arkiv are only ever added, so a stale copy can only be missing the newest ones for a moment.
const PREFIX = "mohar.keep:"

export function keep(name: string, value: unknown) {
  try {
    const text = JSON.stringify(value, (_, v) => (typeof v === "bigint" ? { $big: v.toString() } : v))
    if (text.length < 400_000) localStorage.setItem(PREFIX + name, text)
  } catch {
    // private mode or storage full: the page just loads from the network next time
  }
}

export function kept<T>(name: string): T | undefined {
  try {
    const text = localStorage.getItem(PREFIX + name)
    return text ? (JSON.parse(text, (_, v) => (v && typeof v === "object" && typeof v.$big === "string" ? BigInt(v.$big) : v)) as T) : undefined
  } catch {
    return undefined
  }
}
