import { flushSync } from "react-dom"
import { useEffect, useState } from "react"

const EVENT = "mohar:navigate"

// In-app moves cross-fade. A click on the home page's leak card goes further: the card itself grows into the exam
// page's verdict panel (both carry the same view-transition name only while that one move runs).
export function navigate(href: string, replace = false, morph = false) {
  const url = new URL(href, location.href)
  if (url.origin !== location.origin) return void (location.href = href)
  const commit = () => {
    history[replace ? "replaceState" : "pushState"](null, "", url)
    flushSync(() => window.dispatchEvent(new Event(EVENT)))
    if (!url.hash) window.scrollTo({ top: 0 })
  }
  const toHash = () => url.hash && requestAnimationFrame(() => document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: "smooth" }))
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    commit()
    return toHash()
  }
  const root = document.documentElement
  if (morph) root.dataset.vt = "card"
  const t = document.startViewTransition(commit)
  t.updateCallbackDone.then(toHash, () => undefined)
  t.finished.finally(() => delete root.dataset.vt)
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
      navigate(url.toString(), false, a.classList.contains("leak-card"))
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
