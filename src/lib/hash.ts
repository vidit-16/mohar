import { bytesToHex, type Hex, sha256, stringToBytes } from "viem"

// Same output for "Q4) which article…", "4. Which Article…" and "प्रश्न ४। …". \p{M} keeps Devanagari matras intact.
export function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^\s*(q(uestion)?\s*|प्रश्न\s*|प्र\.?\s*)?(no\.?\s*)?\(?[0-9०-९]{1,3}[).:।-]?\s+/u, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim()
}

export function splitQuestions(paper: string): string[] {
  return paper
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => normalise(line).length > 0)
}

export const questionHash = (text: string): Hex => sha256(stringToBytes(normalise(text)))

export const commitHash = (salt: Hex, text: string): Hex => sha256(stringToBytes(`${salt}|${normalise(text)}`))

export const rootHash = (commits: Hex[]): Hex => sha256(stringToBytes(commits.join("")))

export const randomSalt = (): Hex => bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
