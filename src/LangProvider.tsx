import { type ReactNode, useCallback, useEffect, useState } from "react"
import { DICT, type Key, type Lang, LangCtx } from "./i18n"

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("mohar.lang")
    if (saved === "en" || saved === "hi") return saved
  } catch {
    /* storage blocked */
  }
  return "en"
}

// the Devanagari web font is ~120 KB; English visitors only see मोहर in the logo, which system fonts render fine
function loadHindiFont() {
  if (document.getElementById("font-hi")) return
  const link = document.createElement("link")
  link.id = "font-hi"
  link.rel = "stylesheet"
  link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600&display=swap"
  document.head.appendChild(link)
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  useEffect(() => {
    if (lang === "hi") loadHindiFont()
  }, [lang])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    document.documentElement.lang = l
    try {
      localStorage.setItem("mohar.lang", l)
    } catch {
      /* storage blocked */
    }
  }, [])
  const t = useCallback(
    (k: Key, vars?: Record<string, string | number>) => {
      let s = DICT[lang][k] ?? DICT.en[k]
      if (vars) {
        const n = Number(vars.n)
        const plural = { qs: n === 1 ? "question" : "questions", ws: n === 1 ? "witness" : "witnesses", fps: n === 1 ? "fingerprint" : "fingerprints", es: n === 1 ? "entry" : "entries" }
        for (const [name, v] of Object.entries({ ...plural, ...vars })) s = s.replaceAll(`{${name}}`, String(v))
      }
      return s
    },
    [lang],
  )
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>
}
