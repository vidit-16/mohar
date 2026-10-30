// Writes the first-paint shell (src/ui/Shell.tsx) into index.html. Runs before every build; test/shell.test.ts fails
// if the committed index.html is out of date.
import { readFileSync, writeFileSync } from "node:fs"
import { withShell } from "../src/ui/Shell"

const html = readFileSync("index.html", "utf8")
const next = withShell(html)
if (next === html) console.log("shell up to date")
else {
  writeFileSync("index.html", next)
  console.log("shell written to index.html")
}
