import { useEffect, useState } from "react"

type Theme = "light" | "dark"

const systemTheme = (): Theme => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")

function saved(): Theme | null {
  try {
    const v = localStorage.getItem("mohar.theme")
    return v === "light" || v === "dark" ? v : null
  } catch {
    return null
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => saved() ?? systemTheme())
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    try {
      localStorage.setItem("mohar.theme", next)
    } catch {
      /* storage blocked: the choice lasts for this visit */
    }
  }
  return { theme, toggle }
}
