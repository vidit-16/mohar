import "./index.css"

// index.html ships a static nav + headline. React, the app and the chain code (~200 KB gzipped) are
// fetched only once the browser reports that first paint, so a slow phone sees the page straight away.
let started = false
const start = () => {
  if (started) return
  started = true
  Promise.all([import("react"), import("react-dom/client"), import("./App.tsx")]).then(([{ StrictMode, createElement, startTransition }, { createRoot }, { default: App }]) => {
    const root = createRoot(document.getElementById("root")!)
    // a transition lets React render in small slices, so a slow phone never freezes while the app takes over
    startTransition(() => root.render(createElement(StrictMode, null, createElement(App))))
  })
}

try {
  const paints = new PerformanceObserver((list) => {
    if (!list.getEntriesByName("first-contentful-paint").length) return
    paints.disconnect()
    setTimeout(start, 0)
  })
  paints.observe({ type: "paint", buffered: true })
} catch {
  requestAnimationFrame(() => setTimeout(start, 0))
}
// hidden tabs never paint, and some browsers don't report paints: don't wait forever
setTimeout(start, document.visibilityState === "hidden" ? 200 : 2000)
