// npm run brand: writes public/favicon.svg from the same geometry as the app's seal, and public/og.png from the
// share-card renderer itself, so the home page's preview and every exam's preview are one design.
import { writeFileSync } from "node:fs"
import { GET } from "../api/card"
import { markSvg } from "../src/ui/geometry"

writeFileSync("public/favicon.svg", markSvg())

// an exam ID that doesn't exist gets the card's general face: the headline and the seal
const res = await GET(new Request("http://local/api/card?exam=-"))
writeFileSync("public/og.png", Buffer.from(await res.arrayBuffer()))
console.log("wrote public/favicon.svg and public/og.png")
