import { LacSeal } from "./brand"

// The home page's hero picture: a real exam's result as the product shows it. It is drawn from props only, so the
// first-paint shell renders the same card in its loading state and nothing moves when the chain answers.
export type LeakCardProps = {
  href: string
  title: string
  started: string
  verdict: string
  sub: string
  caught: boolean
  questions: { code: string; text: string; hit: boolean }[]
  hitLabel: string
  stats: { label: string; value: string; tone?: "red" | "ok" }[]
  line?: { sealPct: number; leakPct: number; bellPct: number; labels: [string, string, string] }
  sealLabel?: string
}

export function LeakCard(p: LeakCardProps) {
  return (
    <a className={`leak-card ${p.caught ? "is-caught" : ""}`} href={p.href}>
      {p.caught && <LacSeal size={190} className="leak-card-seal" label={p.sealLabel} />}
      <div className="leak-card-top">
        <b>{p.title}</b>
        <span>{p.started}</span>
      </div>
      <div className="leak-card-body">
        <div className="leak-card-main">
          <h2>{p.verdict}</h2>
          <p className="leak-card-sub">{p.sub}</p>
          <ol className="leak-card-qs">
            {p.questions.map((q) => (
              <li key={q.code} className={q.hit ? "hit" : ""}>
                <code>{q.code}</code>
                <span>{q.text}</span>
                {q.hit && <em>{p.hitLabel}</em>}
              </li>
            ))}
          </ol>
        </div>
        <div className="leak-card-side">
          <dl>
            {p.stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd className={s.tone ?? ""}>{s.value}</dd>
              </div>
            ))}
          </dl>
          {p.line && (
            <div className="leak-card-line" aria-hidden="true">
              <div className="track">
                <i className="seal" style={{ left: `${p.line.sealPct}%` }} />
                <i className="leak" style={{ left: `${p.line.leakPct}%` }} />
                <span className="bell" style={{ left: `${p.line.bellPct}%` }} />
              </div>
              <div className="labels">
                {p.line.labels.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </a>
  )
}
