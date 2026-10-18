# Mohar for exam bodies

How a commission, board or testing agency uses Mohar for a real exam. Nothing to install on your servers, nothing to host; you need one wallet and a CSV of the paper.

## What it gives you

- **A public, undeletable seal of the paper before the exam.** If a "leak" shows up afterwards, anyone can check whether it matches what you sealed.
- **A clean answer to fake leak rumours.** Anyone claiming a leak can be asked: was it sealed on Mohar before the exam? If not, it proves nothing.
- **Early warning.** If witnesses start sealing fingerprints that match your real questions before the exam, you know the paper is out while there's still time to switch sets.

The paper itself is never published before the exam, not even encrypted. Only salted fingerprints are.

## One-time setup

1. **Create a dedicated issuer wallet.** Use it for nothing else. A hardware wallet or a key in an HSM is ideal; on testnet, `npm run wallets` is fine.
2. **Publish the issuer address on your own website** at `https://<your domain>/.well-known/mohar.json`:

   ```json
   { "name": "Uttar Pradesh Public Service Commission", "issuers": ["0xYourIssuerAddress"] }
   ```

   Serve it with `Access-Control-Allow-Origin: *` so browsers can read it. That file is what makes your seals trustworthy: Mohar shows a seal as official only if its on-chain creator is an address your own domain lists. Anyone can post a look-alike; it shows up as "fake seal ignored". Link your exams as `https://mohar-in.vercel.app/?domain=<your domain>&exam=<exam id>`; the page then says "Address confirmed by <your domain>". The same check works without our site: `npx mohar-verify <exam id> --domain <your domain>`, or `check.html` with the website field filled in. When you rotate keys, list the new address first and keep the old one until its exams are done.
3. **Optionally, get the address added to Mohar's built-in registry** (`ISSUERS` in `src/lib/mohar.ts`), so it's the default on the home page. The domain file is still the stronger proof, because it doesn't depend on us.
4. Fund the wallet with a little gas. Sealing a whole paper is one transaction.

## Exam runbook

**T − 24h to T − 1h: seal**

Two ways to do it, same result on chain:

- **In the browser:** open [mohar-in.vercel.app/?issue=1](https://mohar-in.vercel.app/?issue=1), connect MetaMask (a hardware wallet behind MetaMask works) or use the browser's own wallet, paste or upload the CSV, and click *Seal paper*. The salts file downloads straight away. The paper text never leaves your machine before the reveal.
- **From the command line**, for air-gapped or scripted setups:

Export the paper as `set,question`, one row per question, in printed order. Bilingual papers: give each language its own set code (`A-en`, `A-hi`) so a leak in either language matches.

```csv
set,question
A-en,Which river is known as the Dakshin Ganga?
A-hi,किस नदी को दक्षिण गंगा कहा जाता है?
```

```sh
npm run seal -- paper.csv --exam-id UPPSC-PRE-2026-S1 --title "UPPSC Prelims 2026, Shift 1" --opens 2026-11-02T09:30+05:30
```

This writes one sealed record per set, read-only and with ownership burned in the same transaction, so you can't edit or delete it afterwards either. That's the point. The salts go to `secrets/<exam-id>.json`.

**Handling the salts file:** it's the only way to open the seal. Treat it like the paper itself:

- keep it offline (encrypted USB or the same custody as the printed papers), never in email or chat
- make two copies under two-person control; if it's lost, the seal can never be opened
- don't run the reveal from a machine that's online before the exam

**T = 0: reveal**

In the browser: *Reveal* tab, load the salts file, click *Reveal paper* (it stays disabled until the announced start). Or:

```sh
npm run reveal -- secrets/UPPSC-PRE-2026-S1.json
```

It refuses to run before the announced start. All sets are revealed in one transaction, so no set is ever out on its own. Mohar computes its "before the exam" deadline as the earlier of your announced start and this reveal, so announcing a later start can't discredit a real leak.

**After the exam**

The exam page now shows every witness: who held real questions before the start, which rumours were fake, and which claims came too late. Link it from your notice board; it works without our site too (`npx mohar-verify <exam-id>`, or the one-file `check.html`).

## Things to know

- **Matching is exact after normalisation.** Numbering, capitals, punctuation and spacing don't matter; wording does. Seal the questions exactly as printed. A leak that rewords a question won't match it, so treat matches as strong evidence and non-matches as "not proven", not as proof of innocence.
- **Testnet.** This deployment runs on Arkiv's Tiramisu testnet, which has a single sequencer. For a live exam, run it on a production network.
- **Key compromise.** If the issuer key leaks, publish a new address on your website and stop using the old one. Seals already made by the old address stay valid; nothing on chain can be changed by the attacker except new seals under the old address, which your website no longer vouches for.
- **Privacy.** Candidates never touch Mohar. Every witness is sealed from a fresh throwaway wallet, so one person's witnesses aren't linkable, and only fingerprints are stored. There are no names, roll numbers or phone numbers anywhere.
