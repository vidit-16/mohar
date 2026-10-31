// npm run brand: writes public/og.png from the share-card renderer itself, so the home page's preview and every
// exam's preview are one design. The tab icons come from the same lac seal: python scripts/icons.py.
import { writeFileSync } from "node:fs"
import { GET } from "../api/card"

// an exam ID that doesn't exist gets the card's general face: the headline and the seal
const res = await GET(new Request("http://local/api/card?exam=-"))
writeFileSync("public/og.png", Buffer.from(await res.arrayBuffer()))
console.log("wrote public/og.png")
