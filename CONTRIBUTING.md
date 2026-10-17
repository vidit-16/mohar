# Contributing

```sh
npm install
npm run dev            # site on :5173, reads live testnet data
npm test               # unit, parity and translation tests (no network)
npm run test:chain     # live checks against Tiramisu (set ARKIV_KEY in .env to skip the keyless limit)
npm run test:e2e       # builds and drives the site in Chrome, desktop and phone
npm run test:mutation  # Stryker over the verdict logic
```

- Verdict rules live in `src/lib/rules.ts` and must stay in step with `verify/verify.mjs` and `public/check.html`; `test/parity.test.ts` fails if they drift.
- New UI text goes into both `en` and `hi` in `src/i18n.tsx`; `test/i18n.test.ts` checks the keys and placeholders match.
- Don't change the shape of `mohar-v1` payloads. Anything breaking becomes `mohar-v2`, and `arkiv/schemas` gets a new file.
- No real names, phone numbers, roll numbers or papers on chain, ever. Test data is synthetic.
