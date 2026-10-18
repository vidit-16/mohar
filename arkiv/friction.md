# Friction report: building Mohar on Arkiv

Everything here is something I actually hit while building Mohar on 17–18 October 2026, with block numbers or tx hashes where it happened on chain. Every SDK/RPC item has a script in [`repro/`](repro/) that reproduces it on Tiramisu; I re-ran all of them on 18 October and filed each one upstream (links under each item). Each item has steps, expected vs actual, and what I think would fix it. The stuff that just worked is at the bottom, because that's useful to know too.

**Environment:** `@arkiv-network/sdk@0.8.1` (pinned), `viem@2.57.7`, Node 24.19.0, Vite 8, Chrome on Windows 11, Tiramisu testnet (chain 7738577).

**Time to first entity: about 53 minutes** (SDK installed about 14:15 IST, first entity at 15:08 IST, tx `0xbabd2dab…`). About 40 of those minutes were spent getting test GLM (items 1 and 2). Writing code against the SDK took about 10 minutes.

Surfaces used: TypeScript SDK, raw JSON-RPC (`arkiv_query`, `arkiv_getBlockTiming`, also from the zero-dependency `verify.mjs`), WebSocket events, Hub faucet, block explorer, docs. I also read the SDK's shipped `src/`, which ended up being the best documentation.

---

## 1. Faucet page crashes on "Connect wallet → MetaMask"

- **Surface:** hub.arkiv.network/faucet
- **Steps:** open the faucet in Chrome on Windows 11 → *Connect a wallet* → click **MetaMask**.
- **Expected:** a MetaMask connection prompt.
- **Actual:** the whole page is replaced by "THIS PAGE COULDN'T LOAD" with Reload and Back buttons (14:49 IST). After the MetaMask extension was installed and unlocked, the same click worked. So the crash seems to happen when the injected provider is missing or locked, but the error says nothing about that.
- **Fix:** catch the connector error and show "MetaMask not detected or locked. Install or unlock it, or use WalletConnect" instead of crashing the route.
- **Filed:** [Arkiv-Network/reported-issues#19](https://github.com/Arkiv-Network/reported-issues/issues/19).

## 2. Funding a fresh script wallet needs a second, browser-connected wallet

- **Surface:** faucet
- **Steps:** generate a key in Node (`viem` `generatePrivateKey`), then try to fund that address.
- **Expected:** paste an address, pass the CAPTCHA, receive GLM. Faucets like this usually work that way.
- **Actual:** the faucet requires connecting a wallet first. The *Send to* field exists, but the one-hour cooldown is per *connected* wallet. My first claim went to the connected MetaMask account, so I had to add Tiramisu to MetaMask and do a manual transfer to the script wallet. That added about 25 minutes. A first-time builder doesn't have a funded browser wallet on Tiramisu.
- **Fix:** allow anonymous claims to a pasted address behind the existing CAPTCHA (the "You're a human" check already exists), or document "connect any wallet, then use *Send to*" in the quickstart.
- **Filed:** [Arkiv-Network/reported-issues#20](https://github.com/Arkiv-Network/reported-issues/issues/20).

## 3. `extendEntity` with `ExpirationTime.fromDays(n)` sets "n days from now". It does not add n days.

- **Surface:** SDK `extendEntity` + `ExpirationTime`
- **Steps (reproduced on chain):**
  1. `createEntity({ …, expires: ExpirationTime.fromDays(14), flags: { permissionlessExtension: true } })`: witness `0x17f08331…` created at block 690389, `expiresAt` 1295189.
  2. About 30 blocks later, from another wallet: `extendEntity({ entityKey, expires: ExpirationTime.fromDays(14) })`.
  3. Read `expiresAt` again.
- **Expected:** given the method name and the "extend (later only)" wording, about 14 more days (around 1 900 000).
- **Actual:** `expiresAt = 1295219`, only about 30 blocks (one minute) more. The lifetime is measured from the block the extension is built on, not from the current expiry. My UI button said "+14d" and was wrong until I caught it.
- **Workaround (in [`src/lib/mohar.ts`](../src/lib/mohar.ts) `keepAlive`):** `ExpirationTime.atBlock(currentExpiresAt + days * 86400 / blockDuration)`, with `blockDuration` read from `getBlockTiming()` rather than hard-coded. After the fix, the same button moved the witness from 13d 23h to 27d 23h left.
- **Fix:** add `ExpirationTime.by(lifetime)` (relative to the current expiry), or rename the parameter on extend to make "from now" explicit, and say so in the `extendEntity` JSDoc.
- **Repro:** `npx tsx arkiv/repro/3-extend-sets-not-adds.ts`. Re-run on 18 Oct: created with `fromDays(14)`, extended with `fromDays(14)`, **gained 3 blocks** (entity `0xcb90b782…`).
- **Filed:** [Arkiv-Network/arkiv-sdk-js#122](https://github.com/Arkiv-Network/arkiv-sdk-js/issues/122).

## 4. `predictEntityKeys` is missing from the wallet client

- **Surface:** SDK clients
- **Steps:** with `const wallet = createWalletClient({ chain: tiramisu, transport: http(), account })`, call `await wallet.predictEntityKeys({ owner: wallet.account.address, count: 2 })`.
- **Expected:** it works. The wallet is the party that needs predicted keys to create entities and transfer them in the same `executeBatch`.
- **Actual:** TypeScript error *Property 'predictEntityKeys' does not exist on type WalletArkivClient*. It exists only on the public client.
- **Workaround:** a second `createPublicClient` just for key prediction.
- **Fix:** expose `predictEntityKeys` (and the other read actions) on the wallet client, the way viem's wallet clients can be extended with public actions.
- **Repro:** `npx tsx arkiv/repro/4-predict-missing-on-wallet.ts` prints `wallet.predictEntityKeys: undefined`, `reader.predictEntityKeys: function`.
- **Filed:** [Arkiv-Network/arkiv-sdk-js#123](https://github.com/Arkiv-Network/arkiv-sdk-js/issues/123).

## 5. `readonly` doesn't make an entity undeletable, and there is no flag that does

- **Surface:** creation flags
- **Context:** an exam seal must survive its own issuer. `readonly` blocks patches, but per `src/entity/flags.ts` the owner can still delete.
- **Workaround:** the seal batch creates the entity and transfers ownership to `0x…dEaD` in the same transaction (predicted keys + `ownershipChanges`). It works (see the smooth paths below), but burning ownership also blocks extension unless `permissionlessExtension` is set. That's fine for Mohar but surprising.
- **Fix:** an `undeletable` (or `sealed`) creation flag, or a documented "burn ownership" recipe.
- **Repro:** `npx tsx arkiv/repro/5-readonly-is-deletable.ts`: the patch is rejected (*"was created readonly, so its contents can never change"*), then the owner deletes it anyway (tx `0xcd38ea2a…`).
- **Filed:** [Arkiv-Network/reported-issues#21](https://github.com/Arkiv-Network/reported-issues/issues/21).

## 6. Entity events can't be filtered by attribute

- **Surface:** `watchEntityEvents`
- **Observation:** `EntityCreated` carries `entityKey`, `owner`, `expiresAt` and `creationFlags`, but no attributes and no project. To show "a new witness for *this* exam" live, the app has to re-run a query after *any* create on the chain. Combined with the keyless read budget (#7) that's dangerous, so Mohar now refetches at most once every 15 seconds, only while the tab is visible, and with a single query.
- **Fix:** let `watchEntityEvents` take a query predicate (`where(eq("project", …))`), or include attributes in the event.
- **Repro:** `npx tsx arkiv/repro/6-events-without-attributes.ts`. The event's fields are `type, blockNumber, transactionHash, logIndex, entityKey, owner, expiresAt, creationFlags`; no attributes.
- **Filed:** [Arkiv-Network/arkiv-sdk-js#124](https://github.com/Arkiv-Network/arkiv-sdk-js/issues/124).

## 7. Keyless read budget runs out in normal use, and the 429 hides behind a long Retry-After

- **Surface:** public RPC, `arkiv_query`
- **Steps:** use the site normally from one IP for about an hour of development: page reloads, plus the live view refetching after `EntityCreated` events (chain-wide, see #6). At the time each exam page made 4 queries.
- **Expected:** a documented budget, or at least a warning before it runs out.
- **Actual:** at about 16:05 IST every `arkiv_query` started returning `429 {"error":"ANON_COST_LIMITED","message":"unauthenticated query budget exhausted; get an API key at https://hub.arkiv.network for a monthly quota"}` with `ratelimit: limit=10000, remaining=0, reset=2439` and `retry-after: 2439`. That's 100 queries (100 units each) per IP, then a 40-minute lockout. `eth_blockNumber` kept working. With viem's default retry the SDK would have sat silently on that `Retry-After`; Mohar sets `retryCount: 0` so it fails fast and shows "read limit reached".
- **Why it matters:** anyone who clicks around a live app for ten minutes can lock themselves out, and on a shared network (college Wi-Fi, mobile carrier NAT) one heavy user locks everyone out.
- **What I changed:** one query per exam page instead of four (`project AND exam_id = X`, split by type on the client), live refetch throttled to 15 seconds, the network badge on `eth_blockNumber`, and optional `VITE_ARKIV_KEY` support.
- **Fix:** put the budget and window on the Tiramisu docs page; have the SDK surface `Arkiv-Quota-Used-Percent` (already in `access-control-expose-headers`) so apps can back off before hitting zero.
- **Repro:** `npx tsx arkiv/repro/7-keyless-budget.ts` (stops after 5 queries). Two more things it shows: for keyless calls `Arkiv-Quota-Used-Percent` is **empty**, so an app can't see the 10,000-unit budget draining before the 429, and the only `ratelimit` header is a separate 600-per-minute request limit whose `remaining` jumps around (512, 529, 511, 528, 510), which looks like separate counters per backend node.
- **Filed:** already reported as [Arkiv-Network/reported-issues#17](https://github.com/Arkiv-Network/reported-issues/issues/17), so I [added what it was missing](https://github.com/Arkiv-Network/reported-issues/issues/17#issuecomment-6242023708) (empty quota header, jumping `remaining`, shared-IP lockout) instead of opening a duplicate.

## 8. Entities only know their creation *block*, so every timestamp is an extra read

- **Surface:** `select({ createdAt: true })`, raw `arkiv_getEntity`
- **Context:** Mohar's whole verdict is "was this witness sealed before the exam started", and exam times are wall-clock (09:30 IST). Entities carry `createdAt` only as a block number, in the SDK and in raw `arkiv_getEntity` (`createdAt: 0xa87e7`, same for `updatedAt`).
- **Expected:** a creation timestamp next to the block, or a way to select one in the same query.
- **Actual:** one `eth_getBlockByNumber` per distinct block. The demo exam page is 7 entities in 1 query, then 5 more calls (a bit over a second) just to get times. `getBlockTiming` only describes the current block, so estimating past times from `blockDuration` drifts, and that's not good enough when a few seconds decide a verdict.
- **What I changed:** a block-time cache in the app, and the `/api/rpc` proxy lets the CDN cache block reads for a day, since a mined block never changes.
- **Fix:** return a `createdAtTimestamp` (block timestamp) in query results, or let `select` ask for it.
- **Repro:** `npx tsx arkiv/repro/8-created-at-is-a-block.ts`: `7 entities in 1 query, createdAt is a bigint block number (690151)` → `5 extra eth_getBlockByNumber calls`, a bit over a second.
- **Filed:** [Arkiv-Network/reported-issues#22](https://github.com/Arkiv-Network/reported-issues/issues/22).

## 9. One transaction holds about 128 KB, and when it's over the SDK says "Execution error without revert data"

- **Surface:** public RPC (request size), `executeBatch` / `createEntity` error handling
- **Context:** NEET-UG is 180 questions set in 13 languages. Mohar seals every language set and later reveals them all at once, ideally in one atomic `executeBatch`.
- **Steps:** build reveal-shaped batches of 180 questions per set and send 1, 2, 4, 8 and 13 sets in one `executeBatch`.
- **Expected:** either it fits, or a clear "too large" error with the limit.
- **Actual:** 1 set (39 KB) and 2 sets (77 KB) go through. 4 sets (154 KB) and up fail with `Transaction failed: Execution error without revert data`. It isn't gas: a 77 KB batch used 3.2M gas against a 36M block limit. Sending the same data straight to the RPC shows the real reason: a request body of 256 KB or more gets `HTTP 413 {"error":"BAD_REQUEST","message":"request body too large"}`, and transaction data travels as hex (2 characters per byte), so one transaction tops out around **128 KB** of payload. Indian scripts take 3 bytes per character in UTF-8, so a 180-question set in Hindi or Tamil is already 60–80 KB: two such sets per transaction, at most.
- **What I changed:** seal and reveal now pack sets into as few transactions as fit under a 100 KB budget (`packBatches` in `src/lib/rules.ts`, unit tested), with a clear error if a single set can't fit. Verdicts now use the **earliest** reveal block instead of the first in query order, so a split reveal can't move the deadline. Proven on chain with `npm run big-paper`: a 5-language, 900-question paper sealed in 1 transaction and revealed in 5 back-to-back ones within 15 blocks, 900/900 questions matching.
- **Fix:** document the per-request limit next to the other RPC limits, and have the SDK pass the HTTP 413 through (or check the encoded size before sending) instead of turning it into "Execution error without revert data", which reads like a contract revert.
- **Repro:** `npx tsx arkiv/repro/9-batch-size-limit.ts`, plus the raw `eth_estimateGas` probe in [`repro/README.md`](repro/README.md).
- **Filed:** [Arkiv-Network/reported-issues#23](https://github.com/Arkiv-Network/reported-issues/issues/23).

---

## Smooth paths (same rigour, no friction)

| What | Steps | Expected = actual |
|---|---|---|
| Atomic create + ownership burn | `executeBatch({ creates: [2 × paper_commit with salt from predictEntityKeys], ownershipChanges: [→ 0x…dEaD] })` | One tx `0xbabd2dab…`; both entities show `owner = 0x…dEaD`, `creator = issuer` |
| Atomic multi-set reveal | `executeBatch({ creates: [2 × reveal], ownershipChanges })` at the bell | One tx `0x236bd1ad…`; both sets in block 690148 |
| `createdBy` trust | A forged `paper_commit` with the same `exam_id` from another wallet (tx `0xcc102dd0…`) | Excluded by `.createdBy(issuer)`; shown in the "look-alikes ignored" list |
| `u64` range query | `opens_at_ms >= u64(now − 30d)` + `createdBy` | Returns exactly the 2 exams of this issuer |
| `permissionlessExtension` from a stranger | Browser burner wallet (not the owner) extends a witness | Succeeded; owner unchanged |
| WebSocket push | `createPublicClient({ transport: webSocket() })` + `watchEntityEvents` with no `fromBlock` | `eth_subscribe` connection opened in the production build (UI shows "WebSocket connected"); no polling interval used |
| Reads from a static site | `select(...).where(...).fetch()` from the browser, no backend | Worked first time; now 1 query per exam page (see #7 for the budget) |
| Shipped TypeScript source | `node_modules/@arkiv-network/sdk/src` | The fastest documentation available: flag semantics, expiry helpers and query rendering were all clearer there than in the docs |

## What writes cost (real receipts)

From the demo run in [`demo-run.txt`](demo-run.txt), read back with `eth_getTransactionReceipt` on 18 Oct. Gas price was 1 gwei on every one.

| Write | Gas used | Test GLM | Calldata |
|---|---|---|---|
| Seal: 2 sets + ownership burn, one batch ([`0xbabd2dab…`](https://tiramisu.explorer.arkiv.network/tx/0xbabd2dab589ca9d03a59081b1e5d0d1bb64f72da32927fdd8dcb0e4985f03c95)) | 293,664 | 0.00029 | 5,764 B |
| Reveal: 2 sets, 10 questions, one batch ([`0x236bd1ad…`](https://tiramisu.explorer.arkiv.network/tx/0x236bd1ade0b8efe84f20e075e0d874e1df70feeae539c05a0cec635391849aa7)) | 272,432 | 0.00027 | 5,188 B |
| Witness, 4 hashes ([`0x5a61a269…`](https://tiramisu.explorer.arkiv.network/tx/0x5a61a269c1204fadde52d6c5f7f6740f30949184cf95de1718c81d5cfa18b0fc)) | 104,960 | 0.00010 | 1,860 B |
| Witness, 1 hash ([`0xf1c9cefa…`](https://tiramisu.explorer.arkiv.network/tx/0xf1c9cefac67fc4f7c2c796a9309274a8a1ed857abaa65310dfc92edd734596de)) | 101,648 | 0.00010 | 1,636 B |

So the 0.02 GLM the site drips into a fresh browser wallet covers roughly 190 witnesses, and a whole exam (seal + reveal) costs under 0.0006 GLM. A witness is mostly fixed overhead: 4 hashes cost only 3% more than 1.

## The one thing to improve first

**Item 3:** make "extend" mean extend. Every "keep alive" or lease product built on Arkiv will reach for `extendEntity(…fromDays(n))` and silently get "n days from now".
