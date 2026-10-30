// npm run brand: writes public/favicon.svg and public/og.png from the same geometry as the app's seal.
// The social image is rendered by headless Chrome because it shapes Devanagari properly.
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { CLOCK, CLOCK_SMALL, scallopPath } from "../src/ui/geometry"

const SEAL = "#a8291c", LO = "#6e170e", INK = "#fbe9df"
const print = (size: number, w: number, paths = CLOCK) =>
  `<g transform="scale(${size / 64})" fill="none" stroke="${INK}" stroke-width="${w / (size / 64)}" stroke-linecap="round">${paths.map((d) => `<path d="${d}"/>`).join("")}</g>`

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${scallopPath(32, 32, 30, 14)}" fill="${SEAL}"/><g transform="translate(32 32)">${print(42, 4.6, CLOCK_SMALL)}</g></svg>`
writeFileSync("public/favicon.svg", favicon)

const emblem = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})">
  <defs><filter id="ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter>
  <path id="top" d="M34 100 A66 66 0 0 1 166 100"/><path id="bot" d="M21 100 A79 79 0 0 0 179 100"/></defs>
  <g filter="url(#ink)"><path d="${scallopPath(100, 100, 92, 26)}" fill="${SEAL}"/>
  <circle cx="100" cy="100" r="84" fill="none" stroke="${LO}" stroke-width="1.5" opacity=".6"/>
  <circle cx="100" cy="100" r="58" fill="${LO}" opacity=".35"/>
  <text font-size="14.5" font-weight="700" letter-spacing="5" fill="${INK}" font-family="Segoe UI" text-anchor="middle"><textPath href="#top" startOffset="${(Math.PI * 66) / 2 + 2.5}">MOHAR</textPath></text>
  <text font-size="20" font-weight="600" fill="${INK}" font-family="Nirmala UI" text-anchor="middle"><textPath href="#bot" startOffset="50%">मोहर</textPath></text>
  <circle cx="29" cy="100" r="3" fill="${INK}"/><circle cx="171" cy="100" r="3" fill="${INK}"/>
  <g transform="translate(100 100)">${print(70, 3.4)}</g></g></g>`

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f7f5f0"/>
  <rect x="0" y="0" width="1200" height="630" fill="none" stroke="#e6e1d6" stroke-width="24"/>
  ${emblem(760, 125, 1.9)}
  <text x="80" y="230" font-family="Georgia" font-size="74" font-weight="700" fill="#1a1814">Prove who had</text>
  <text x="80" y="320" font-family="Georgia" font-size="74" font-weight="700" fill="#1a1814">the paper first.</text>
  <text x="80" y="440" font-family="Segoe UI" font-size="28" fill="#5c564a">Tamper-proof records for exam paper leaks.</text>
  <text x="80" y="540" font-family="Segoe UI" font-size="30" font-weight="700" fill="#1a1814">Mohar <tspan font-family="Nirmala UI" fill="${SEAL}">मोहर</tspan></text>
</svg>`
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}</style>${og}`
const dir = mkdtempSync(join(tmpdir(), "mohar-og-"))
writeFileSync(join(dir, "og.html"), html)
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
if (!chrome) throw new Error("Chrome not found")
execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1200,630", `--screenshot=${resolve("public/og.png")}`, pathToFileURL(join(dir, "og.html")).href], { stdio: "ignore" })
console.log("wrote public/favicon.svg and public/og.png")
