import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"

const mount = () =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

// index.html ships a static nav + headline; let the browser paint it before React takes over.
// Background tabs don't run animation frames, so a timer makes sure the app still starts there.
let started = false
const start = () => {
  if (started) return
  started = true
  mount()
}
requestAnimationFrame(() => setTimeout(start, 0))
setTimeout(start, 200)
