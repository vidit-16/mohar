// A synthetic question paper. Not taken from any real exam.
import type { PaperSet } from "../src/lib/mohar"

export const SETS: PaperSet[] = [
  {
    code: "A",
    questions: [
      "Which river is known as the Dakshin Ganga?",
      "The Tropic of Cancer does NOT pass through which of these states: Gujarat, Odisha, Tripura, Mizoram?",
      "Who presides over a joint sitting of both Houses of Parliament?",
      "Which Article of the Constitution deals with the Finance Commission?",
      "The Loktak lake is located in which state?",
    ],
  },
  {
    code: "B",
    questions: [
      "Which Schedule of the Constitution lists the official languages?",
      "The Nathu La pass connects Sikkim with which region?",
      "Which gas is most abundant in the Earth's atmosphere?",
      "Who was the first Chief Election Commissioner of India?",
      "Simlipal National Park is located in which state?",
    ],
  },
]

/** What witness A received on Telegram the night before: three real set-A questions and one fake. */
export const LEAK_A = `Q2. The Tropic of Cancer does NOT pass through which of these states: Gujarat, Odisha, Tripura, Mizoram?
Q4)  which article of the constitution deals with the finance commission
Q5. The Loktak lake is located in which state?
Q9. Name the longest railway platform in India.`

/** What witness B claims after the exam started: a set-B question, sealed too late to prove anything. */
export const LATE_B = `Which gas is most abundant in the Earth's atmosphere?`
