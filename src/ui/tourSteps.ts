import type { TourAction } from "./ExamPage"

export const DEMO_EXAM = "DSPSC-PRE26-10170937"
export const LIVE_EXAM = "DSPSC-PRE26-U10170941"

export type TourStep = {
  exam?: string
  target?: string
  action?: TourAction
  en: string
  hi: string
  end?: boolean
}

export const LEAK_SAMPLE = `Q1. Which river is known as the Dakshin Ganga?
Q7. Who was the first Chief Election Commissioner of India?`

export const STEPS: TourStep[] = [
  {
    target: ".hero",
    en: "The night before an exam, a 'leaked paper' goes round Telegram. After the exam, nobody can prove when it actually existed.",
    hi: "परीक्षा से पहले की रात टेलीग्राम पर एक 'लीक' पेपर घूमता है। परीक्षा के बाद कोई साबित नहीं कर पाता कि वह कब से था।",
  },
  {
    target: "[data-tour=proof]",
    en: "Forty-one leaks in five years, across fifteen states. Every time, the fight is about one thing: time.",
    hi: "पाँच साल में इकतालीस लीक, पंद्रह राज्यों में। हर बार झगड़ा एक ही बात पर होता है: समय।",
  },
  {
    target: "#how",
    en: "Mohar gives everyone a clock that neither the exam body nor the leakers control. Seal, witness, verdict.",
    hi: "मोहर सबको एक ऐसी घड़ी देता है जिस पर न परीक्षा संस्था का बस चलता है, न लीक करने वालों का। मोहर, गवाही, निर्णय।",
  },
  {
    exam: DEMO_EXAM,
    target: "[data-tour=exam-head]",
    en: "Here's a demo state prelims. Everything on this page lives on a public network, not on our server.",
    hi: "यह एक डेमो राज्य प्रारंभिक परीक्षा है। इस पेज की हर चीज़ एक सार्वजनिक नेटवर्क पर है, हमारे सर्वर पर नहीं।",
  },
  {
    exam: DEMO_EXAM,
    target: "[data-tour=seal]",
    en: "Before the exam, the commission sealed a fingerprint of every question. Nobody can edit or delete this seal. Not even the commission.",
    hi: "परीक्षा से पहले आयोग ने हर प्रश्न का फ़िंगरप्रिंट सील किया। इस मोहर को कोई बदल या मिटा नहीं सकता। आयोग भी नहीं।",
  },
  {
    exam: DEMO_EXAM,
    target: "[data-tour=forged]",
    action: { action: "forged-open" },
    en: "Someone tried to fake an official seal for this exam. Mohar ignores it, because only the real commission's signature counts.",
    hi: "किसी ने इस परीक्षा की नकली मोहर बनाने की कोशिश की। मोहर इसे अनदेखा करता है, क्योंकि सिर्फ़ असली आयोग के हस्ताक्षर मायने रखते हैं।",
  },
  {
    exam: DEMO_EXAM,
    target: "[data-tour=timeline]",
    en: "This is the whole exam on one line. The stamp is the seal, the bell is the start, and every dot is someone who came forward.",
    hi: "यह पूरी परीक्षा एक लाइन पर है। मोहर सील है, घंटी परीक्षा की शुरुआत, और हर बिंदु एक गवाह है।",
  },
  {
    exam: DEMO_EXAM,
    target: "[data-tour=meaning]",
    en: "One witness sealed some questions before the exam. When the paper came out, three of them were real.",
    hi: "एक गवाह ने परीक्षा से पहले कुछ प्रश्न सील किए। पेपर आने पर उनमें से तीन असली निकले।",
  },
  {
    exam: DEMO_EXAM,
    target: "[data-tour=evidence] .compare",
    action: { action: "evidence-leak" },
    en: "The network recorded this witness minutes before the bell. Nobody can change that timestamp, not us, not the commission.",
    hi: "नेटवर्क ने इस गवाही को घंटी से कुछ मिनट पहले दर्ज किया। यह समय कोई नहीं बदल सकता, न हम, न आयोग।",
  },
  {
    exam: DEMO_EXAM,
    target: "[data-tour=matches]",
    action: { action: "evidence-leak" },
    en: "These are the exact questions that leaked. The fourth one in the rumour was made up, and it didn't match.",
    hi: "ये वही प्रश्न हैं जो लीक हुए। अफ़वाह में चौथा प्रश्न मनगढ़ंत था, और वह मेल नहीं खाया।",
  },
  {
    exam: DEMO_EXAM,
    target: "[data-tour=w-late]",
    action: { action: "close" },
    en: "This claim came after the exam started. It's marked too late, because anyone can 'have' a paper once it's out.",
    hi: "यह दावा परीक्षा शुरू होने के बाद आया। इसे देर से माना गया, क्योंकि पेपर बाहर आने के बाद तो किसी के भी पास हो सकता है।",
  },
  {
    exam: DEMO_EXAM,
    target: "[data-tour=paper]",
    en: "At the bell, every set was revealed together, and every question matches what was sealed.",
    hi: "घंटी बजते ही सारे सेट एक साथ जारी हुए, और हर प्रश्न सील से मेल खाता है।",
  },
  {
    exam: DEMO_EXAM,
    target: "[data-tour=verify]",
    en: "And if this website is ever blocked, anyone can check all of it straight from the network.",
    hi: "और अगर यह वेबसाइट कभी बंद भी हो जाए, कोई भी सीधे नेटवर्क से सब जाँच सकता है।",
  },
  {
    exam: LIVE_EXAM,
    target: "[data-tour=seal-btn]",
    action: { action: "witness", prefill: LEAK_SAMPLE },
    en: "Your turn. Got a leaked paper before an exam? Paste it here. Only fingerprints leave your phone, never the questions or your name.",
    hi: "अब आपकी बारी। परीक्षा से पहले लीक पेपर मिला? यहाँ डालें। सिर्फ़ फ़िंगरप्रिंट जाते हैं, न प्रश्न, न आपका नाम।",
  },
  {
    end: true,
    en: "Mohar. Prove who had the paper before the exam.",
    hi: "मोहर। साबित करें, पेपर परीक्षा से पहले किसके पास था।",
  },
]

export function tourHref(step: number) {
  const s = STEPS[Math.max(0, Math.min(step, STEPS.length - 1))]
  const p = new URLSearchParams()
  if (s.exam) p.set("exam", s.exam)
  p.set("tour", "1")
  p.set("step", String(step))
  // recording mode (rec=1) survives every step
  if (new URLSearchParams(location.search).get("rec") === "1") p.set("rec", "1")
  return `?${p.toString()}`
}
