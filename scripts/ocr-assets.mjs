// Copies the on-device OCR engine and its English + Hindi data from node_modules into public/ocr, so the photo
// witness loads them from this site (the CSP allows nothing else, and the photo itself never leaves the phone).
// Runs before every build and dev server; public/ocr is not committed.
import { copyFileSync, mkdirSync } from "node:fs"

const out = "public/ocr"
mkdirSync(`${out}/core`, { recursive: true })
mkdirSync(`${out}/lang`, { recursive: true })
copyFileSync("node_modules/tesseract.js/dist/worker.min.js", `${out}/worker.min.js`)
// tesseract.js picks one of these per device, depending on its SIMD support
for (const variant of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) copyFileSync(`node_modules/tesseract.js-core/tesseract-core-${variant}.wasm.js`, `${out}/core/tesseract-core-${variant}.wasm.js`)
for (const lang of ["eng", "hin"]) copyFileSync(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `${out}/lang/${lang}.traineddata.gz`)
console.log("ocr assets ready in public/ocr")
