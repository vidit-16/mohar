# mohar-verify

Rebuilds every [Mohar](https://mohar-in.vercel.app) verdict for an exam straight from the public Arkiv RPC: which seals are official, whether the revealed paper matches them, and which witnesses held real questions before the exam started.

No dependencies, no website, no API key. One file, Node 18+.

```sh
npx mohar-verify DSPSC-PRE26-10170937
```

```
sealed exam DSPSC-PRE26-10170937: 2 set(s) by 0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6, 1 look-alike(s) from other wallets ignored
paper revealed: 10/10 questions match the seal
deadline 2026-10-17T09:40:54.039Z (earlier of announced start and reveal)

0x0dbab71656… 0xcf1bbbe4… 2026-10-17T09:41:08.000Z AFTER: too late
0x518da20dea… 0xa1befa50… 2026-10-17T09:38:08.000Z BEFORE: LEAK A-Q2, A-Q4, A-Q5
```

## Usage

```sh
npx mohar-verify <exam-id> [issuer-address] [--domain exam-body.gov.in] [--paper paper.txt]
```

- `issuer-address`: the exam body's published address. Only seals created by it count. Defaults to the demo exam body.
- `--domain`: trust whatever addresses the exam body lists at `https://<domain>/.well-known/mohar.json` instead of a fixed address. This is the strongest check, because the trust comes from the exam body's own website.
- `--paper`: for an open exam (no official seal), the official paper as a text file, one question per line.
- `ARKIV_RPC`: point it at another RPC endpoint.

It also works as a plain copy: download [`verify.mjs`](https://github.com/vidit-16/mohar/blob/main/verify/verify.mjs) and run `node verify.mjs <exam-id>`.

The hashing helpers are exported too:

```js
import { normalise, sha, lines } from "mohar-verify"
sha(normalise("Q4) Which river is known as the Dakshin Ganga?"))
```

The rules match the app exactly; the repo's tests check it on 2000 random mixed-script strings. MIT license.
