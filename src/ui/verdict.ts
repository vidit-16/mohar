import type { useT } from "../i18n"
import type { Verdict } from "../lib/mohar"
import type { Tone } from "./primitives"

export type VerdictView = { tone: Tone; title: string; short: string; explain: string; kind: "checking" | "late" | "wait" | "leak" | "fake" }

export function describe(t: ReturnType<typeof useT>["t"], v: Verdict | undefined, hasPaper: boolean, total: number): VerdictView {
  if (!v) return { kind: "checking", tone: "neutral", title: t("v.checking"), short: "…", explain: "" }
  if (!v.before) return { kind: "late", tone: "warn", title: t("v.late.t"), short: t("v.late.s"), explain: t("v.late.d") }
  if (!hasPaper) return { kind: "wait", tone: "info", title: t("v.wait.t"), short: t("v.wait.s"), explain: t("v.wait.d") }
  if (v.matches.length > 0)
    return { kind: "leak", tone: "danger", title: t("v.leak.t", { n: v.matches.length }), short: `${t("v.leak.s")} · ${v.matches.length}/${total}`, explain: t("v.leak.d") }
  return { kind: "fake", tone: "good", title: t("v.fake.t"), short: `${t("v.fake.s")} · 0/${total}`, explain: t("v.fake.d") }
}
