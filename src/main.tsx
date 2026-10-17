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

// index.html ships a static nav + headline; let the browser paint it before React takes over
requestAnimationFrame(() => setTimeout(mount, 0))
