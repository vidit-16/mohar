# Build on Mohar

Everything Mohar knows lives in public Arkiv entities. You don't need this repo, an API key or permission to read them or to add your own. This page is the contract.

## The data

- Network: Arkiv Tiramisu testnet, chain `7738577`, RPC `https://rpc.tiramisu.db-chain.testnet.arkiv.network`
- Every Mohar entity has the attribute `project = 'mohar-v1'`. A breaking change gets a new label (`mohar-v2`); `v1` never changes shape.
- Entity types: `paper_commit`, `reveal`, `open_exam`, `witness`. Attributes and lifetimes: [`arkiv/schema.md`](../arkiv/schema.md).
- Payload shapes, as JSON Schema: [`arkiv/schemas/payloads.schema.json`](../arkiv/schemas/payloads.schema.json). A test validates every payload on chain against it.
- Labels are not trust. Anyone can write an entity with `project = 'mohar-v1'`. Trust an exam body's seal only if `$creator` is that body's address.

## Hashing rules

So your hashes match everyone else's:

```js
normalise = (t) => t.normalize("NFKC").toLowerCase()
  .replace(/^\s*(q(uestion)?\s*|प्रश्न\s*|प्र\.?\s*)?(no\.?\s*)?\(?[0-9०-९]{1,3}[).:।-]?\s+/u, "")   // leading "Q4)", "12.", "(3)", "प्रश्न ४।"
  .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")                         // keep letters, digits, Indic marks
  .trim()

witness hash  = sha256(utf8(normalise(question)))
commit hash   = sha256(utf8(salt + "|" + normalise(question)))     // salt is the 0x-prefixed hex string
```

[`verify.mjs`](../verify/verify.mjs) is a dependency-free reference implementation, and a test checks it against the app on 2000 random mixed-script strings.

## Recipes

**Read an exam in one call**

```sh
curl -s https://rpc.tiramisu.db-chain.testnet.arkiv.network -H 'content-type: application/json' -d '{
  "jsonrpc":"2.0","id":1,"method":"arkiv_query",
  "params":["project = str('\''mohar-v1'\'') AND exam_id = str('\''DSPSC-PRE26-10170937'\'')",
            {"select":{"key":true,"creator":true,"createdAt":true,"attributes":true,"payload":true}}]}'
```

**Upcoming exams in the next 30 days** (`opens_at_ms` is a `u64`, so ranges work):

```
project = str('mohar-v1') AND opens_at_ms >= u64(<now>) AND opens_at_ms <= u64(<now + 30d>)
```

**Verdicts without this repo:** `npx mohar-verify <exam-id> [issuer] [--paper official.txt]`, or open [`check.html`](../public/check.html) in any browser

**Examples you can run as-is** (Node 18+, no install):

- [`examples/witness-count.mjs`](../examples/witness-count.mjs): who sealed a witness for an exam, and when.
- [`examples/leak-alerts.mjs`](../examples/leak-alerts.mjs): watches upcoming exams and prints a line for every new witness. Swap the `console.log` for a Telegram or WhatsApp call and a coaching institute has a leak-alert bot.

## Writing

Anyone can add an `open_exam` or a `witness` from any wallet. Use the same attributes, payload shapes and flags (`readonly` + `permissionlessExtension`) and the Mohar site will show your records like its own. With TypeScript, `src/lib/mohar.ts` has `createOpenExam`, `witnessPaper` and `keepAlive` ready to copy.

Things that would be good to build:

- a Telegram bot that seals a forwarded "leak" as a witness straight from the chat
- a newsroom dashboard of exams with witnesses that matched
- a browser extension that hashes a highlighted question and checks it against open exams
