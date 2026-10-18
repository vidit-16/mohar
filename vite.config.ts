import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// The stylesheet is ~8 KB gzipped but render-blocking, and on a slow phone it queues behind ~200 KB of
// preloaded JS, so the static shell in index.html couldn't paint for seconds. Inlining it lets the first
// paint need nothing but the HTML.
function inlineCss(): Plugin {
  return {
    name: "mohar-inline-css",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find((f) => f.type === "asset" && f.fileName === "index.html")
      if (!html || html.type !== "asset") return
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type !== "asset" || !name.endsWith(".css")) continue
        const tag = new RegExp(`<link rel="stylesheet"[^>]*href="[^"]*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`)
        const source = String(html.source)
        if (!tag.test(source)) continue
        html.source = source.replace(tag, () => `<style>${String(file.source)}</style>`)
        delete bundle[name]
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), inlineCss()],
  base: "./",
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // vite's tiny preload helper must not land in the chain chunk, or the entry drags 100 KB in with it
            { name: "preload", test: /preload-helper|modulepreload-polyfill/, priority: 10 },
            { name: "chain", test: /node_modules.(viem|@arkiv-network|@noble|@scure|abitype|ox)/ },
            { name: "react", test: /node_modules.(react|react-dom|scheduler)./ },
          ],
        },
      },
    },
  },
})
