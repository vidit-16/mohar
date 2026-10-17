# Friction repros

One script per SDK/RPC item in [`../friction.md`](../friction.md). Each one runs against Tiramisu and prints what happened. They sign with `WITNESS_A_KEY` from `.env` (`npm run wallets`, then fund it) and create short-lived entities under `project = 'mohar-repro'`, never `mohar-v1`.

```sh
npx tsx arkiv/repro/3-extend-sets-not-adds.ts
npx tsx arkiv/repro/4-predict-missing-on-wallet.ts
npx tsx arkiv/repro/5-readonly-is-deletable.ts
npx tsx arkiv/repro/6-events-without-attributes.ts
npx tsx arkiv/repro/7-keyless-budget.ts
```

Output from 18 Oct 2026 (`@arkiv-network/sdk 0.8.1`, Node 24.19.0, Windows 11):

```
=== 3-extend-sets-not-adds
created 0xcb90b782e4849f8ff05112bf08dd292d2ee3d19ab9f42d683f4bc613880fcb8a expiresAt 1311344n
extended with fromDays(14), expiresAt 1311347n
gained 3 blocks = 0.1 minutes (expected ~14 days = 604800 blocks)

=== 4-predict-missing-on-wallet
wallet.predictEntityKeys: undefined
reader.predictEntityKeys: function

=== 5-readonly-is-deletable
created readonly entity 0xd915886439950cdd990436968ad11a34284d60268138e1dfb36439dbce38200b
patch: rejected, as expected: Transaction failed: entity 0xd9158864…38200b was created readonly, so its contents can never change.
delete by owner: ALLOWED, tx 0xcd38ea2a472c653ec8d5e6d597be316fcc18b0637773fe3eb9d61149af1dcbfb

=== 6-events-without-attributes
event fields: type, blockNumber, transactionHash, logIndex, entityKey, owner, expiresAt, creationFlags
has attributes / project / exam_id: false false false

=== 7-keyless-budget
query 1: HTTP 200, ratelimit="limit=600, remaining=512, reset=4", Arkiv-Cost=100, Arkiv-Quota-Used-Percent=null
query 2: HTTP 200, ratelimit="limit=600, remaining=529, reset=3", Arkiv-Cost=100, Arkiv-Quota-Used-Percent=null
query 3: HTTP 200, ratelimit="limit=600, remaining=511, reset=3", Arkiv-Cost=100, Arkiv-Quota-Used-Percent=null
query 4: HTTP 200, ratelimit="limit=600, remaining=528, reset=3", Arkiv-Cost=100, Arkiv-Quota-Used-Percent=null
query 5: HTTP 200, ratelimit="limit=600, remaining=510, reset=3", Arkiv-Cost=100, Arkiv-Quota-Used-Percent=null
eth_blockNumber is not budgeted: 0xac80b
```

Items 1 and 2 are about the Hub faucet page, so they're steps in `friction.md`, not scripts.
