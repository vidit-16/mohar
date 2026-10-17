import type { PaperSet } from "./rules"

// "set,question" with one row per question in paper order; quoted questions may contain commas and "" escapes
export function parsePaperCsv(text: string): PaperSet[] {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim())
  if (!/^set\s*,\s*question/i.test(rows.shift() ?? "")) throw new Error('First line must be "set,question"')
  const sets = new Map<string, string[]>()
  for (const [n, row] of rows.entries()) {
    const comma = row.indexOf(",")
    if (comma < 1) throw new Error(`Line ${n + 2}: expected "set,question"`)
    const code = row.slice(0, comma).trim()
    if (!/^[A-Za-z0-9._-]{1,32}$/.test(code)) throw new Error(`Line ${n + 2}: set code "${code}" should be letters, digits, . _ - (max 32)`)
    const question = row.slice(comma + 1).trim().replace(/^"(.*)"$/s, "$1").replace(/""/g, '"')
    if (!question) throw new Error(`Line ${n + 2}: empty question`)
    sets.set(code, [...(sets.get(code) ?? []), question])
  }
  if (sets.size === 0) throw new Error("No questions found")
  return [...sets].map(([code, questions]) => ({ code, questions }))
}
