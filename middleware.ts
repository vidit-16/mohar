// Runs on Vercel before static files. A shared witness link (/?exam=…&w=…) is answered by /api/share,
// which is the same page with the verdict in its preview tags; every other request is untouched.
export const config = { matcher: "/" }

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url)
  if (!url.searchParams.has("w") || !url.searchParams.has("exam")) return undefined
  const res = await fetch(new URL(`/api/share${url.search}`, url.origin), { headers: { "user-agent": request.headers.get("user-agent") ?? "" } })
  // fetch has already decompressed the body, so the upstream encoding and length no longer describe it;
  // passing them on makes browsers fail to decode the page
  const headers = new Headers(res.headers)
  for (const h of ["content-encoding", "content-length", "transfer-encoding"]) headers.delete(h)
  return new Response(res.body, { status: res.status, headers })
}
