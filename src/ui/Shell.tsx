// The first paint, written into index.html by scripts/shell.ts: the nav, the home hero and its result card in the
// loading state. It shows while the app's code downloads, so it is built from the same parts as what replaces it.
import { ArrowRight, Play } from "lucide-react"
import { renderToStaticMarkup } from "react-dom/server"
import { DICT } from "../i18n"
import { SealOutline, Wordmark } from "./brand"
import { LeakCard } from "./LeakCard"
import { loadingCard } from "./leakCardLoading"
import { DEMO_EXAM } from "./tourSteps"

const t = DICT.en

// never hot-reloaded: only the build script and a test import this file
// oxlint-disable-next-line react/only-export-components
function Shell() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="nav">
        <div className="container nav-inner">
          <a href="./" className="logo">
            <Wordmark size={34} />
          </a>
          <nav className="nav-links">
            <a href="./#how">{t["nav.how"]}</a>
            <a href="./#exams">{t["nav.exams"]}</a>
            <a href="./#issuers">{t["nav.bodies"]}</a>
          </nav>
        </div>
      </header>
      <main id="main" className="container" data-shell="">
        <section className="hero">
          <SealOutline className="hero-outline" />
          <p className="hero-live">
            <i aria-hidden="true" />
            {t["pulse.live"]}
          </p>
          <h1>{t["hero.title"]}</h1>
          <p className="lead">{t["hero.lead"]}</p>
          <div className="hero-cta">
            <a className="btn btn-primary btn-lg" href="?tour=1&step=0">
              <Play size={17} /> {t["hero.tour"]}
            </a>
            <a className="btn btn-secondary btn-lg" href="#exams">
              {t["hero.browse"]} <ArrowRight size={17} />
            </a>
          </div>
          <LeakCard {...loadingCard((k) => t[k], `?exam=${DEMO_EXAM}`)} />
        </section>
      </main>
    </>
  )
}

export function withShell(html: string) {
  return html.replace(/<div id="root">[\s\S]*?<\/div>(\r?\n\s*)<script type="module"/, (_, ws: string) => `<div id="root">${renderToStaticMarkup(<Shell />)}</div>${ws}<script type="module"`)
}
