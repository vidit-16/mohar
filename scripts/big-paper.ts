// Seals and reveals a NEET-sized synthetic paper (180 questions) in 5 languages, to show a paper too big for
// one transaction going out in a few. Synthetic text only.
//   npm run big-paper
import "dotenv/config"
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { type Hex, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { RPC_URL, revealExam, sealExam } from "../src/lib/mohar"

const issuer = createWalletClient({ chain: tiramisu, transport: http(RPC_URL, { retryCount: 0 }), account: privateKeyToAccount(process.env.ISSUER_KEY as Hex) })
const LANGS = {
  en: (i: number) => `Q${i}. Which of the following statements about demo organism ${i} is correct? (1) it is unicellular (2) it is multicellular (3) it has no nucleus (4) none of these`,
  hi: (i: number) => `प्रश्न ${i}. नमूना जीव ${i} के बारे में निम्नलिखित में से कौन सा कथन सही है? (1) यह एककोशिकीय है (2) यह बहुकोशिकीय है (3) इसमें केंद्रक नहीं है (4) इनमें से कोई नहीं`,
  bn: (i: number) => `প্রশ্ন ${i}. নমুনা জীব ${i} সম্পর্কে নিচের কোন বক্তব্যটি সঠিক? (1) এটি এককোষী (2) এটি বহুকোষী (3) এর নিউক্লিয়াস নেই (4) কোনোটিই নয়`,
  ta: (i: number) => `கேள்வி ${i}. மாதிரி உயிரினம் ${i} பற்றிய பின்வரும் கூற்றுகளில் எது சரி? (1) இது ஒருசெல் உயிரி (2) இது பலசெல் உயிரி (3) இதற்கு உட்கரு இல்லை (4) எதுவுமில்லை`,
  mr: (i: number) => `प्रश्न ${i}. नमुना जीव ${i} बद्दल खालीलपैकी कोणते विधान बरोबर आहे? (1) तो एकपेशीय आहे (2) तो बहुपेशीय आहे (3) त्याला केंद्रक नाही (4) यापैकी नाही`,
}
const examId = `DEMO-MULTILANG-${Date.now().toString(36).toUpperCase()}`
const opensAtMs = Date.now() + 3 * 60_000
const sets = Object.entries(LANGS).map(([lang, q]) => ({ code: `A-${lang}`, questions: Array.from({ length: 180 }, (_, i) => q(i + 1)) }))

const sealed = await sealExam(issuer, { examId, title: "Demo NEET-sized paper, 5 languages", shift: 1, opensAtMs, sets })
console.log(`sealed ${examId}: ${sets.length} sets × 180 questions in ${sealed.txHashes.length} tx: ${sealed.txHashes.join(", ")}`)
const wait = opensAtMs - Date.now() + 5_000
console.log(`waiting ${Math.round(wait / 1000)} s for the start…`)
await new Promise((r) => setTimeout(r, wait))
const revealed = await revealExam(issuer, sealed.secrets, opensAtMs)
console.log(`revealed in ${revealed.txHashes.length} tx: ${revealed.txHashes.join(", ")}`)
console.log(`open https://mohar-in.vercel.app/?exam=${examId}`)
