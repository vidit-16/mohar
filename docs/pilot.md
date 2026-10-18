# Running a Mohar pilot

A plan for an exam body (a state PSC, a recruitment board, a university) that wants to try Mohar on real exams, and for the people who can use it today without waiting for one. Costs below are measured on the Tiramisu testnet from real transactions; production costs depend on Arkiv's mainnet fees.

## What a pilot has to prove

1. Sealing and revealing fits into the paper-setting and exam-day routine without new risk.
2. When a "leaked paper" appears, the body can settle it publicly within hours, with a link anyone can check.
3. Nothing about the paper is exposed before the exam, and nothing about candidates is exposed ever.

## Four weeks

| Week | What happens | Who | Done when |
|---|---|---|---|
| 0 · setup | Create a dedicated issuer wallet (hardware wallet or HSM). Publish its address at `https://<your domain>/.well-known/mohar.json`. Seal and reveal a mock paper end to end. | IT cell + exam controller | `?domain=<your domain>&exam=<mock id>` shows "Address confirmed by <your domain>" |
| 1 · shadow | Seal a low-stakes exam (a mock test or internal assessment) the day before; reveal at the bell. Nothing is announced publicly. | Exam controller, two key holders | Paper shows N/N questions match the seal; reveal went out within a minute of the start |
| 2 · one real shift | Seal one shift of a real exam and publish the exam page link on the notice board before the start. | Same, plus whoever runs the notice board | Link was public before the exam; anyone could check it without asking |
| 3–4 · full cycle | Seal every shift and every language set of one exam. Handle any leak claims by pointing to the page. | Same | Every rumour that surfaced has a public verdict link |

The exam-body runbook with the exact commands is in [for-exam-bodies.md](for-exam-bodies.md).

## What it costs

From real receipts on Tiramisu (1 gwei gas price):

| Action | Size | Test GLM |
|---|---|---|
| Seal a 10-question, 2-set paper | 1 transaction | 0.0003 |
| Seal a 180-question paper in 5 languages | 1 transaction, 73 KB | 0.0027 |
| Reveal that paper | 5 back-to-back transactions within 15 blocks | 0.014 |
| One witness | 1 transaction | 0.0001 |

One transaction carries about 128 KB, so a paper in many Indian languages is revealed in a few transactions instead of one; verdicts always use the earliest, so splitting can't help anyone ([friction #9](../arkiv/friction.md)). No servers to run: the site, the read proxy and the test-GLM drip are already hosted, and anyone can check every verdict without them.

## Keys and salts

- **Issuer key:** one wallet used for nothing else, in a hardware wallet or HSM. Its only power is to seal and reveal; it can't edit or delete anything already sealed, because ownership is burned in the same transaction.
- **Salts file:** the only way to open the seal, so treat it like the printed paper: offline, encrypted, two copies under two-person control. If it's lost before the exam, the seal can never be opened; re-seal under a new exam ID and say so publicly.
- **Key rotation:** list the new address first in `mohar.json` and keep the old one until its exams are over. Seals made earlier stay valid.

## When something goes wrong

| Situation | What happens |
|---|---|
| A "leaked paper" goes viral before the exam | Ask the person sharing it to witness it on the exam page (it takes a minute and reveals nothing). At the bell the page shows whether it matched. |
| A screenshot claims a leak after the exam | Without a witness sealed before the start, it proves nothing; the page says so. That was UGC-NET 2024: cancelled over a screenshot the CBI later called doctored, months after the fact ([cases](leaks.md)). With a sealed paper, the same check takes minutes. |
| A real leak | The page shows exactly which questions of which set were held, and when, on a clock the body doesn't control. That's evidence for the investigation, not just a rumour. |
| Mohar's site is down or blocked | Everything is still readable: `npx mohar-verify <exam id> --domain <your domain>`, the one-file `check.html`, or the static copy on GitHub Pages. |
| A question was sealed with a typo | Matching is exact after normalisation. Seal exactly the printed text, and check the preview before sealing. |

## How you'll know it worked

- **Time to settle a leak claim:** from first report to a public verdict link. Today that's weeks to months; the target is the same day.
- **Rumours dismissed with a link** instead of a press release.
- **Witnesses sealed before the start** for each exam, as a sign that people trust the channel.
- **Disputed seals:** zero. Every seal is checkable by anyone, so there should be nothing to dispute.

## Using it today, without an exam body

Nobody has to wait for a commission to sign up. Open exams work for any exam right now:

- **Journalists.** Someone sends you a "leaked paper" the night before an exam. Open the exam on Mohar (or add it: title and start time), paste the paper, and seal it: one minute, and the text never leaves your phone. After the exam, paste the official paper and the page shows whether your copy was real and early. Before publishing a leak story, ask the source for their witness link. No link sealed before the start means the claim is unproven.
- **Coaching institutes and student groups.** Seal every "leak" that reaches your group before the exam. Afterwards you can show students, with a link, which rumours were fake. The [leak-alert example](../examples/leak-alerts.mjs) prints a line whenever a new witness is sealed before an exam; swap its `console.log` for a Telegram call and it's an alert bot.
- **Anyone sharing proof.** The evidence drawer's "Copy link" gives a link whose preview on Telegram, X or WhatsApp already shows the verdict ("Leak: held 3 real questions before the exam" or "Sealed after the exam started"), drawn live from the chain.

## What Mohar doesn't do

- It doesn't stop a leak. It makes the timeline of one undeniable.
- It matches questions exactly after normalisation. A reworded question won't match, so a match is strong evidence and a non-match is "not proven", not proof of innocence.
- This deployment runs on Arkiv's Tiramisu testnet, which has a single sequencer. A live exam should run on a production network.
