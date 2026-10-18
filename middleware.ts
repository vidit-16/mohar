// Runs on Vercel before static files. A shared witness link (/?exam=…&w=…) is answered by /api/share,
// which is the same page with the verdict in its preview tags; every other request is untouched.
export const config = { matcher: "/" }

export default function middleware(request: Request): Promise<Response> | undefined {
  const url = new URL(request.url)
  if (!url.searchParams.has("w") || !url.searchParams.has("exam")) return undefined
  return fetch(new URL(`/api/share${url.search}`, url.origin), { headers: { "user-agent": request.headers.get("user-agent") ?? "" } })
}
