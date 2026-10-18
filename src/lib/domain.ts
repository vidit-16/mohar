import type { Address } from "viem"

// An exam body proves which wallet seals its papers by publishing
//   https://<its own domain>/.well-known/mohar.json   {"name": "...", "issuers": ["0x..."]}
// so trust comes from the body's website, not from a list inside Mohar.
export type DomainProof = { domain: string; name: string; issuers: Address[] }

export const PROOF_PATH = "/.well-known/mohar.json"

export function normaliseDomain(input: string): string | null {
  // cut at the first / ? # with split, not a /[/?#].*$/ regex, which goes quadratic on input like "####…"
  const host = input
    .trim()
    .toLowerCase()
    .slice(0, 300)
    .replace(/^https?:\/\//, "")
    .split(/[/?#]/, 1)[0]
    .replace(/\.$/, "")
  return /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host) ? host : null
}

export function parseProof(domain: string, body: unknown): DomainProof {
  if (!body || typeof body !== "object") throw new Error("not a JSON object")
  const { name, issuers } = body as { name?: unknown; issuers?: unknown }
  if (typeof name !== "string" || !name.trim() || name.length > 120) throw new Error("missing or invalid name")
  if (!Array.isArray(issuers) || issuers.length === 0 || issuers.length > 10) throw new Error("issuers must list 1 to 10 addresses")
  for (const a of issuers) if (typeof a !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error(`not an address: ${String(a).slice(0, 50)}`)
  return { domain, name: name.trim(), issuers: issuers as Address[] }
}

export async function fetchProof(input: string, get: typeof fetch = fetch): Promise<DomainProof> {
  const domain = normaliseDomain(input)
  if (!domain) throw new Error("not a valid domain")
  const url = `https://${domain}${PROOF_PATH}`
  const res = await get(url, { headers: { accept: "application/json" }, redirect: "error", credentials: "omit" }).catch(() => {
    // browsers hide the reason: offline, DNS, a redirect, or no Access-Control-Allow-Origin header on the file
    throw new Error(`couldn't load ${url} (offline, redirected, or the file isn't served with Access-Control-Allow-Origin: *)`)
  })
  if (!res.ok) throw new Error(`${PROOF_PATH} returned HTTP ${res.status}`)
  return parseProof(domain, await res.json().catch(() => null))
}
