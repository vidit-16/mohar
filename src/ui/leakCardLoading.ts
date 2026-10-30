import type { Key } from "../i18n"
import type { LeakCardProps } from "./LeakCard"
import { DEMO_TITLE } from "./tourSteps"

// The hero card before the chain answers, the same size as when it does, so the page doesn't move; also what the
// first-paint shell shows.
export function loadingCard(t: (k: Key) => string, href: string): LeakCardProps {
  return {
    href,
    title: DEMO_TITLE,
    started: " ",
    verdict: t("hero.card.loading"),
    sub: " ",
    caught: false,
    questions: [1, 2, 3, 4, 5].map((i) => ({ code: `A-Q${i}`, text: " ", hit: false })),
    hitLabel: "",
    stats: [t("exam.stat.witnesses"), t("hero.app.early"), t("exam.stat.integrity"), t("exam.stat.forged")].map((label) => ({ label, value: "…" })),
  }
}
