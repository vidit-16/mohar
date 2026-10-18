import { useEffect, useState } from "react"
import type { Address } from "viem"
import { fetchProof } from "../lib/domain"
import { ISSUERS } from "../lib/mohar"

// Which wallet's seals count, and why: Mohar's own registry, an address in the link,
// or (strongest) a file the exam body publishes on its own website.
export type IssuerSource = "registry" | "link" | "domain"
export type Issuer = { issuer: Address; issuerName: string; source: IssuerSource; domain?: string; home: string }
export type IssuerState = { status: "ready"; value: Issuer } | { status: "loading"; domain: string } | { status: "failed"; domain: string; error: string }

export function useIssuer(params: URLSearchParams): IssuerState {
  const domain = params.get("domain")
  const linked = params.get("issuer") as Address | null
  const [proof, setProof] = useState<{ domain: string; state: IssuerState } | undefined>()

  useEffect(() => {
    if (!domain) return
    let current = true
    fetchProof(domain)
      .then((p) => {
        if (current) setProof({ domain, state: { status: "ready", value: { issuer: p.issuers[0], issuerName: p.name, source: "domain", domain: p.domain, home: `?domain=${p.domain}` } } })
      })
      .catch((e: Error) => {
        if (current) setProof({ domain, state: { status: "failed", domain, error: e.message } })
      })
    return () => {
      current = false
    }
  }, [domain])

  if (domain) return proof?.domain === domain ? proof.state : { status: "loading", domain }
  if (linked) return { status: "ready", value: { issuer: linked, issuerName: ISSUERS[linked] ?? "Custom issuer", source: ISSUERS[linked] ? "registry" : "link", home: `?issuer=${linked}` } }
  const first = Object.keys(ISSUERS)[0] as Address
  return { status: "ready", value: { issuer: first, issuerName: ISSUERS[first], source: "registry", home: "./" } }
}
