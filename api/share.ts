// Chat apps build link previews from the HTML's meta tags without running any JavaScript, so a shared
// witness link (/?exam=…&w=…) is rewritten here: the normal page, with the verdict in its preview tags.
import { cardMeta, injectMeta, loadCard } from "./_share.js"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const exam = url.searchParams.get("exam") ?? ""
  const w = url.searchParams.get("w") ?? ""
  try {
    const page = await fetch(new URL("/index.html", url.origin)).then((r) => {
      if (!r.ok) throw new Error(`index.html: ${r.status}`)
      return r.text()
    })
    const card = await loadCard(exam, w)
    const image = new URL(`/api/card?exam=${encodeURIComponent(exam)}&w=${encodeURIComponent(w)}`, url.origin).toString()
    return new Response(injectMeta(page, cardMeta(card, image, url.toString())), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, s-maxage=60, stale-while-revalidate=600" },
    })
  } catch {
    // never strand a person who clicked a shared link: /index.html isn't rewritten, so this is the plain app
    return Response.redirect(new URL(`/index.html${url.search}`, url.origin).toString(), 302)
  }
}
