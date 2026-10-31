// How the site's functions reach Arkiv: with the access key when there is one, and without it if the key is out of
// quota or refused, so a spent key makes reads share the public budget instead of failing.
export const UPSTREAM = "https://rpc.tiramisu.db-chain.testnet.arkiv.network"

export async function arkiv(body: string): Promise<Response> {
  const init = { method: "POST", headers: { "content-type": "application/json" }, body }
  const key = process.env.ARKIV_KEY?.trim()
  if (key) {
    const res = await fetch(`${UPSTREAM}/${key}`, init)
    if (res.status !== 429 && res.status !== 401 && res.status !== 403) return res
  }
  return fetch(UPSTREAM, init)
}
