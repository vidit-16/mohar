// Browser text-to-speech with an Indian English or Hindi voice when the system has one.
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window

export function pickVoice(lang: "en" | "hi") {
  const want = lang === "hi" ? "hi" : "en-IN"
  const voices = speechSynthesis.getVoices()
  const match = voices.filter((v) => v.lang.toLowerCase().startsWith(want.toLowerCase()))
  return match.find((v) => /natural|online/i.test(v.name)) ?? match[0] ?? voices.find((v) => v.lang.startsWith(lang))
}

// Hindi questions get a Hindi voice even when the page is in English, and the other way round.
export const langOf = (text: string): "en" | "hi" => (/[ऀ-ॿ]/.test(text) ? "hi" : "en")

export function speakAll(parts: string[], rate: number, onDone: () => void) {
  speechSynthesis.cancel()
  parts.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text)
    const lang = langOf(text)
    u.lang = lang === "hi" ? "hi-IN" : "en-IN"
    const v = pickVoice(lang)
    if (v) u.voice = v
    u.rate = rate
    if (i === parts.length - 1) u.onend = u.onerror = onDone
    speechSynthesis.speak(u)
  })
}
