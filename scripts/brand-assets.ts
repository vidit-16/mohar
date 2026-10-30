// npm run brand: writes public/favicon.svg from the same geometry as the app's seal, and public/og.png from the
// share-card renderer itself, so the home page's preview and every exam's preview are one design.
import { writeFileSync } from "node:fs"
import { GET } from "../api/card"
import { CLOCK_SMALL, scallopPath } from "../src/ui/geometry"

const SEAL = "#c4281a", INK = "#fff4f1"
const print = (size: number, w: number) =>
  `<g transform="scale(${size / 64})" fill="none" stroke="${INK}" stroke-width="${w / (size / 64)}" stroke-linecap="round">${CLOCK_SMALL.map((d) => `<path d="${d}"/>`).join("")}</g>`

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 70 70"><path d="${scallopPath(32, 32, 30, 14)}" fill="${SEAL}"/><g transform="translate(32 32)">${print(42, 4.6)}</g></svg>`
writeFileSync("public/favicon.svg", favicon)

// an exam ID that doesn't exist gets the card's general face: the headline and the seal
const res = await GET(new Request("http://local/api/card?exam=-"))
writeFileSync("public/og.png", Buffer.from(await res.arrayBuffer()))
console.log("wrote public/favicon.svg and public/og.png")
