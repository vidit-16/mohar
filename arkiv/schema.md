# Mohar data model

Network: Tiramisu (chain 7738577). SDK: `@arkiv-network/sdk@0.8.1`, pinned exactly. Every entity has `project = 'mohar-v1'`.
All reads and writes live in [`src/lib/mohar.ts`](../src/lib/mohar.ts). The zero-dependency verifier [`verify.mjs`](../verify/verify.mjs) re-implements the reads from raw JSON-RPC.

The model answers three questions:

1. Was this paper sealed by the real exam body before the exam? (`paper_commit`, trusted by `$creator`)
2. Did anyone hold a question before the exam started? (`witness`, timed by its block)
3. Is the paper revealed at the exam the same one that was sealed? (`reveal` checked against `paper_commit`)

Labels like `project` and `type` are **not** trust. Anyone can write an entity with them. Trust only ever comes from `$creator`.

## Entities

### `paper_commit`: one per question-paper set, by the exam body

| attribute | type | why |
|---|---|---|
| `project`, `type` | str | namespace |
| `exam_id` | str | every record of an exam shares it |
| `shift` | i32 | shown in the UI |
| `set_code` | str | pairs a commit with its reveal |
| `opens_at_ms` | u64 | announced start; numeric so the home page can range-query it |
| `n_q` | i32 | number of questions |
| `root` | bytes32 | sha256 over the set's commits |

Payload: `{ v, title, commits: [sha256(salt_i | normalise(q_i))] }`.
Flags: `readonly`, `permissionlessExtension`.
The same `executeBatch` that creates it also transfers ownership to `0x…dEaD`, using keys from `predictEntityKeys`. `readonly` alone still lets the owner delete; after the burn, nobody can, the exam body included.
Expiry: `atDate(opens_at + 30 days, { atLeast: 14 days })`. That covers the result and grievance window, and anyone can extend it.

### `reveal`: one per set, by the exam body, at the exam

| attribute | type |
|---|---|
| `project`, `type`, `exam_id`, `set_code` | str |
| `root` | bytes32, recomputed from the revealed salts; must equal the commit's |

Payload: `{ v, salts, questions }`. All sets go out in **one atomic `executeBatch`**, so a set can never be revealed on its own. Flags, burn and expiry are the same as `paper_commit`.

### `open_exam`: any exam, added by anyone

For exams whose body isn't on Mohar (which today is all of them). An aspirant adds the exam and its announced start time from the official notice, and witnesses work straight away.

| attribute | type |
|---|---|
| `project`, `type`, `exam_id` | str (`exam_id` = `open-<slug>-<6 hex>`) |
| `opens_at_ms` | u64 |

Payload: `{ v, title, notice? }`. Flags: `readonly`, `permissionlessExtension`. Expiry: start + 60 days.
If several entries share an ID, the **first one created wins** and later ones are shown as conflicts. A late duplicate can't move the start time.

### `witness`: anyone, from a throwaway browser wallet

| attribute | type |
|---|---|
| `project`, `type`, `exam_id` | str |
| `n_q` | i32 |

Payload: `{ v, hashes: [sha256(normalise(q))] }`. **Hashes only**; the pasted text never leaves the device.
Flags: `readonly`, `permissionlessExtension`. The witness keeps ownership, so they can withdraw (the deletion is itself on chain).
Expiry: 14 days. Anyone can press "Keep alive" to add 14 days, so a disputed claim stays up through a hearing without the original witness.

## Lifetimes

| type | lives | reason |
|---|---|---|
| `paper_commit`, `reveal` | exam + 30 days | result and grievance window |
| `open_exam` | exam + 60 days | open exams have no official reveal; leave time to check |
| `witness` | 14 days, extendable by anyone | uncontested claims fade; contested ones are kept alive by whoever cares |

"Keep alive" computes `atBlock(currentExpiry + 14 days of blocks)`. `extendEntity(fromDays(14))` would mean "14 days from now" (see friction.md #3).

Expiry is not erasure: creation transactions stay in chain history. That's why nothing secret is ever written.

## Queries

```text
# exam page: ONE query loads seals, reveals, open-exam entries and witnesses (200 per page, cursor after)
project = str('mohar-v1') AND exam_id = str('<id>')

# home, sealed tab: u64 range + createdBy
project = str('mohar-v1') AND type = str('paper_commit') AND opens_at_ms >= u64(<now - 30d>) AND $creator = addr('<issuer>')

# home, open tab
project = str('mohar-v1') AND type = str('open_exam') AND opens_at_ms >= u64(<now - 30d>)
```

The exam page used to make four queries. With keyless reads capped at about 100 per IP (friction.md #7), one query per page is the difference between a visitor being able to click around and getting locked out. Commits and reveals are then kept only if `creator` equals the issuer, which is the same `$creator` check, just done after the query.

There's no server-side ordering, so witnesses are sorted by `createdAt` on the client.

Live updates use `watchEntityEvents` on a `webSocket()` transport with no `fromBlock`. Events don't carry attributes, so a create anywhere on the chain triggers at most one refetch per 15 seconds, and only while the tab is visible.

## Verdict rules (client side, no server)

- **deadline** = the earlier of `opens_at_ms` and the block time of the reveal. An exam body that announces a later start than the real one can't make late witnesses look early.
- A witness is **before** if its block time is earlier than the deadline. Self-reported times are never used.
- A witness question **matches** official question *k* if `sha256(normalise(q))` equals `sha256(normalise(revealed_k))` **and** `sha256(salt_k | normalise(revealed_k))` equals sealed commit *k*.
- Open exams have no reveal, so the checker pastes the official paper (published after every major exam). It's hashed and compared on their device; nothing is written.

`normalise` = NFKC, lowercase, strip a leading question number, collapse every run of non letter/digit/mark characters to a space. `\p{M}` keeps Devanagari matras, so मोहर and मेहर stay different.

## What stays off Arkiv

- The paper before the exam, not even encrypted. Only salted hashes are sealed.
- The salts before the exam.
- Witness question text. Only hashes go on chain, and the reveal supplies the text.
- Any identity: every witness is sealed from a brand-new browser wallet, funded by the shared drip and retired right after, so one person's witnesses can't be tied to each other or to the wallet they use for anything else. No names, phone numbers, roll numbers, images or PDFs. (Honest limit: the RPC and the drip see the IP address of each request, like any web server.)
- The issuer's real-world identity. That's a static address list in the app (`ISSUERS`), overridable with `?issuer=0x…`.

## Threat model

| attack | what stops it |
|---|---|
| Someone posts a fake "official" seal for an exam | Only commits whose `$creator` is the registered issuer count. The demo has one on chain (tx `0xcc102dd0…`), shown as "fake seals ignored". |
| Exam body edits or deletes its seal after a leak | `readonly` blocks edits; ownership is burned in the same tx, so nobody can delete. |
| Exam body swaps a question after sealing | The reveal's `hash(salt \| question)` won't match the commit; the UI shows ✗ and "Paper matches seal" drops below 100%. Unit tested. |
| Exam body announces a later start to discredit a leak | The deadline is the earlier of the announced start and the actual reveal block. |
| Exam body reveals one set early | All sets are revealed in one atomic batch; a reveal before the announced start is flagged. |
| Witness backdates a claim | Time comes from the block, which only the chain sets. |
| Someone claims a leak after the paper is out | Sealed after the deadline means "too late", whatever matches. |
| Fake rumour papers flood the exam | Spam can't create a leak verdict, because only hashes matching the sealed paper count. Fake rumours show up as "no match". |
| Duplicate open-exam entry with a different start time | First entry by `createdAt` wins; later ones are listed as conflicts. |
| Guessing what a witness holds from their hashes | Hashes are of single questions, so someone who already has the paper can check them. Before the exam that lets the exam body see its real questions circulating, which works as an early warning. Witnesses use burner wallets, so nothing links back to a person. |
| Linking one person's witnesses together | Each witness is sealed from a new wallet funded by the same public drip that funds everyone, then retired, so on chain the witnesses share nothing but that common funder. The old keys stay in the browser so the person can still extend their own records. |
| Witness evidence expires during a dispute | Anyone can extend a witness (`permissionlessExtension`), and the creation tx stays in history regardless. |
| This website is blocked or taken down | Every exam page has raw `curl` commands, and `npx mohar-verify <exam-id>` or the one-file `check.html` rebuild every verdict from the public RPC with zero dependencies. |
| Someone tampers with Mohar's issuer list, or the site itself | Exam bodies publish their address at `https://<their domain>/.well-known/mohar.json`; with `?domain=`, `--domain` or the `check.html` website field, only addresses that file lists count, so trust comes from the body's own website, not from us. |
| Evidence expires before anyone notices | A weekly GitHub Action (`npm run keep-alive`) extends any record within 3 weeks of expiry; anyone else can run the same script. |
| Someone scripts the test-GLM drip to drain it | Each request needs a fresh, server-signed proof-of-work puzzle tied to that one wallet (17 bits: about half a second on a laptop, a few seconds on a phone), checked statelessly with an HMAC. Only wallets with zero balance and zero transactions get 0.02 GLM, from a separate small wallet, so a solved puzzle can't be replayed. The 5-per-IP-per-hour limit is in memory per serverless instance, so it's a speed bump, not the defence. Worst case is an empty drip wallet, after which the site falls back to faucet instructions. |

Known limits: matching is exact after normalisation, so a reworded or translated question won't match. Tiramisu is a single-sequencer testnet, so time is only as trustworthy as its sequencing.

## Wallets that created the demo entities (Tiramisu)

| role | address | creates |
|---|---|---|
| Issuer, "Demo State Public Service Commission" (synthetic) | `0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6` | `paper_commit`, `reveal` |
| Witness A | `0xA1BeFA506054F89b1eaF8e15259c90b895ecf40D` | `witness` before the exam; a later look-alike `open_exam` that moves the start (ignored) |
| Witness B, also the forger | `0xCf1bbbE459d5E9b60A3F809A93FF111DcfCe7013` | look-alike `paper_commit` (ignored), `witness` after the exam |
| Browser burner (my testing) | `0x368cAbd27838BA645f883076cC87A839a7457043` | `witness` on the upcoming exam, the demo `open_exam` and its `witness`, extensions |
| Visitors | a fresh browser wallet per witness, plus one stable browser wallet | `witness` (fresh wallet each time); `open_exam` and extensions (stable wallet) |

Demo exams: `DSPSC-PRE26-10170937` (sealed, held, revealed, one leak), `DSPSC-PRE26-U10170941` (sealed, upcoming, open for witnesses) `open-demo-mock-test-open-exam-e96c10` (open exam added from the site; a witness sealed 3 minutes before the start matches 1 of 2 questions when the official paper is pasted; a later look-alike entry from witness A claims the start was 3 hours later, tx `0xc74a428e…`, and is shown as ignored), and `DEMO-BILINGUAL-2` (sealed from a CSV with English and Hindi sets; a witness that pasted `प्रश्न १। …` matches `A-hi-Q1`). `DEMO-BILINGUAL-1` is the first run of that test: its Hindi witness was hashed before the normaliser learned Hindi numbering (`प्रश्न`, `प्र.`, `१`, `।`), so it correctly stays "no match"; on-chain hashes never change. Transcript: [`demo-run.txt`](demo-run.txt).
