import { useEffect, useState } from "react"

const EVENT = "mohar:navigate"

export function navigate(href: string, replace = false) {
  const url = new URL(href, location.href)
  if (url.origin !== location.origin) return void (location.href = href)
  history[replace ? "replaceState" : "pushState"](null, "", url)
  window.dispatchEvent(new Event(EVENT))
  if (url.hash) requestAnimationFrame(() => document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: "smooth" }))
  else window.scrollTo({ top: 0 })
}

export function useSearch() {
  const [search, setSearch] = useState(location.search)
  useEffect(() => {
    const sync = () => setSearch(location.search)
    window.addEventListener("popstate", sync)
    window.addEventListener(EVENT, sync)
    return () => {
      window.removeEventListener("popstate", sync)
      window.removeEventListener(EVENT, sync)
    }
  }, [])
  return search
}

// Plain <a href="?exam=…"> links stay crawlable and middle-clickable; ordinary clicks become in-app navigation.
export function useLinkInterception() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement).closest("a")
      if (!a || a.target || a.hasAttribute("download")) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin || url.pathname !== location.pathname) return
      if (url.search === location.search && url.hash) return
      e.preventDefault()
      navigate(url.toString())
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])
}

export function examHref(examId: string) {
  const p = new URLSearchParams(location.search)
  p.set("exam", examId)
  p.delete("tour")
  p.delete("step")
  return `?${p.toString()}`
}
