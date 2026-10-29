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

// the Devanagari web font is ~120 KB; English visitors only see मोहर in the logo, which system fonts render fine.
// Self-hosted like the other fonts, so switching to Hindi on a slow or blocked network doesn't depend on Google.
function loadHindiFont() {
  if (document.getElementById("font-hi")) return
  const style = document.createElement("style")
  style.id = "font-hi"
  style.textContent =
    '@font-face{font-family:"Noto Sans Devanagari";font-weight:400 600;font-display:swap;' +
    'src:url(/fonts/noto-sans-devanagari.woff2) format("woff2");' +
    "unicode-range:U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF}"
  document.head.appendChild(style)
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
        const plural = { qs: n === 1 ? "question" : "questions", ws: n === 1 ? "witness" : "witnesses", fps: n === 1 ? "fingerprint" : "fingerprints", es: n === 1 ? "entry" : "entries", ss: n === 1 ? "seal" : "seals" }
        for (const [name, v] of Object.entries({ ...plural, ...vars })) s = s.replaceAll(`{${name}}`, String(v))
      }
      return s
    },
    [lang],
  )
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>
}
