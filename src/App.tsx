import { Moon, Sun } from "lucide-react"
import type { Address } from "viem"
import { useChain } from "./hooks/useChain"
import { useT } from "./i18n"
import { LangProvider } from "./LangProvider"
import { ISSUERS } from "./lib/mohar"
import { useLinkInterception, useSearch } from "./router"
import { useTheme } from "./theme"
import { Wordmark } from "./ui/brand"
import { ExamPage } from "./ui/ExamPage"
import { EXPLORER, REPO } from "./ui/format"
import { Home } from "./ui/Home"
import { ToastHost } from "./ui/primitives"
import { Tour } from "./ui/Tour"

export default function App() {
  return (
    <LangProvider>
      <ToastHost>
        <Shell />
      </ToastHost>
    </LangProvider>
  )
}

function Shell() {
  const search = useSearch()
  useLinkInterception()
  const params = new URLSearchParams(search)
  const issuer = (params.get("issuer") as Address | null) ?? (Object.keys(ISSUERS)[0] as Address)
  const issuerName = ISSUERS[issuer] ?? "Custom issuer"
  const home = params.get("issuer") ? `?issuer=${issuer}` : "./"
  const examId = params.get("exam")

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav home={home} />
      <main id="main" className="container">
        {examId ? <ExamPage key={examId} examId={examId} issuer={issuer} issuerName={issuerName} homeHref={home} /> : <Home issuer={issuer} issuerName={issuerName} />}
      </main>
      <Footer />
      <Tour search={search} />
    </>
  )
}

function Nav({ home }: { home: string }) {
  const { t, lang, setLang } = useT()
  const { block, online } = useChain()
  const { theme, toggle } = useTheme()
  return (
    <header className="nav">
      <div className="container nav-inner">
        <a href={home} className="logo">
          <Wordmark size={34} />
        </a>
        <nav className="nav-links">
          <a href={`${home}#how`}>{t("nav.how")}</a>
          <a href={`${home}#exams`}>{t("nav.exams")}</a>
          <a href={`${home}#issuers`}>{t("nav.bodies")}</a>
        </nav>
        <div className="nav-right">
          <div className="lang" role="group" aria-label="Language">
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")} aria-pressed={lang === "en"}>
              EN
            </button>
            <button className={lang === "hi" ? "on" : ""} onClick={() => setLang("hi")} aria-pressed={lang === "hi"} lang="hi">
              हिं
            </button>
          </div>
          <button className="theme-btn" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <a className={`net ${online === false ? "net-down" : ""}`} href={EXPLORER} target="_blank" rel="noreferrer" title="Network status">
            <i />
            <span className="hide-sm">{t("nav.testnet")}</span>
            <code>{block !== undefined ? `#${block}` : "…"}</code>
          </a>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  const { t } = useT()
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <Wordmark size={22} />
        <span className="grow" />
        <a href={REPO}>{t("footer.source")}</a>
        <a href={`${REPO}/blob/main/arkiv/schema.md`}>{t("footer.data")}</a>
      </div>
    </footer>
  )
}
