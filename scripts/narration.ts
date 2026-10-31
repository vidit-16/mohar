// Records the tour's narration with Sarvam's Ritu voice, one clip per step and language, into public/tour/.
// Each clip is named after a hash of its line, so a changed line gets a new clip (and browsers can cache them for
// good); clips for lines that no longer exist are removed. Only lines without a clip are sent, so a rerun is cheap.
//   SARVAM_API_KEY=… tsx scripts/narration.ts
import "dotenv/config"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { STEPS } from "../src/ui/tourSteps"

const DIR = "public/tour"
const key = process.env.SARVAM_API_KEY?.trim()
if (!key) throw new Error("SARVAM_API_KEY is not set")
const ffmpeg = execFileSync("python", ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim()

mkdirSync(DIR, { recursive: true })
const manifest: Record<"en" | "hi", string[]> = { en: [], hi: [] }
for (const lang of ["en", "hi"] as const) {
  for (const [i, s] of STEPS.entries()) {
    const text = s[lang]
    const name = `${lang}-${String(i).padStart(2, "0")}-${createHash("sha256").update(text).digest("hex").slice(0, 8)}.mp3`
    manifest[lang].push(name)
    if (existsSync(join(DIR, name))) continue
    const res = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text, target_language_code: lang === "hi" ? "hi-IN" : "en-IN", speaker: "ritu", model: "bulbul:v3", speech_sample_rate: 24000 }),
    })
    if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`)
    const { audios } = (await res.json()) as { audios: string[] }
    const wav = join(tmpdir(), `mohar-${name}.wav`)
    writeFileSync(wav, Buffer.concat(audios.map((a) => Buffer.from(a, "base64"))))
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-b:a", "64k", join(DIR, name)])
    rmSync(wav)
    console.log("recorded", name)
  }
}
const keepNames = new Set([...manifest.en, ...manifest.hi])
for (const f of readdirSync(DIR)) if (!keepNames.has(f)) rmSync(join(DIR, f))
writeFileSync("src/ui/narration.json", `${JSON.stringify(manifest, null, 2)}\n`)
console.log("narration ready:", keepNames.size, "clips")
