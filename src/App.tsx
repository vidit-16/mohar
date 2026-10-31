import { Moon, Sun } from "lucide-react"
import { lazy, Suspense } from "react"
import { useChain } from "./hooks/useChain"
import { useIssuer } from "./hooks/useIssuer"
import { useT } from "./i18n"
import { LangProvider } from "./LangProvider"
import { useLinkInterception, useSearch } from "./router"
import { useTheme } from "./theme"
import { Wordmark } from "./ui/brand"
import { ExamPage } from "./ui/ExamPage"
import { EXPLORER, REPO } from "./ui/format"
import { Home } from "./ui/Home"
import { IssuerPage } from "./ui/IssuerPage"
import { Empty, Spinner, ToastHost } from "./ui/primitives"
import { Tour } from "./ui/Tour"

// only speakers ever open the stage view, so it (and its QR library) loads on demand
const Stage = lazy(() => import("./ui/Stage").then((m) => ({ default: m.Stage })))

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
  const { t } = useT()
  const params = new URLSearchParams(search)
  const trust = useIssuer(params)
  const home = trust.status === "ready" ? trust.value.home : "./"
  const examId = params.get("exam")
  const stage = params.get("stage")

  if (stage && examId) {
    const issuer = params.get("issuer") ?? ""
    const qr = params.get("qr") ?? ""
    return (
      <Suspense fallback={<Empty icon={<Spinner size={22} />} title="" />}>
        <Stage
          examId={examId}
          remote={stage === "remote"}
          issuer={/^0x[0-9a-fA-F]{40}$/.test(issuer) ? (issuer as `0x${string}`) : undefined}
          qr={qr.startsWith("https://") && !/\s/.test(qr) ? qr : undefined}
        />
      </Suspense>
    )
  }

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav home={home} />
      <main id="main" className="container">
        {params.has("issue") ? (
          <IssuerPage homeHref={home} />
        ) : trust.status === "loading" ? (
          <Empty icon={<Spinner size={22} />} title={t("domain.loading").replace("{domain}", trust.domain)} />
        ) : trust.status === "failed" ? (
          <Empty title={t("domain.failed").replace("{domain}", trust.domain)}>
            <p className="muted small">{trust.error}</p>
            <p className="muted small">{t("domain.failedHint")}</p>
          </Empty>
        ) : examId ? (
          <ExamPage key={examId} examId={examId} issuer={trust.value.issuer} issuerName={trust.value.issuerName} source={trust.value.source} domain={trust.value.domain} homeHref={home} />
        ) : (
          <Home issuer={trust.value.issuer} issuerName={trust.value.issuerName} />
        )}
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
      <div className="container footer-name" aria-hidden="true" translate="no">
        मोहर
      </div>
      <div className="container footer-inner">
        <Wordmark size={22} />
        <span className="grow" />
        <a href={REPO}>{t("footer.source")}</a>
        <a href={`${REPO}/blob/main/arkiv/schema.md`}>{t("footer.data")}</a>
        <span className="footer-copy">© 2026 <a href="https://www.linkedin.com/in/vidit-choudhary/">Vidit Choudhary</a> · MIT</span>
      </div>
    </footer>
  )
}
