import { createContext, type ReactNode, useContext } from "react"

export type Tone = "neutral" | "seal" | "good" | "warn" | "danger" | "info"
export type Toast = { id: number; tone: Tone; title: string; body?: ReactNode }
export const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => undefined)
export const useToast = () => useContext(ToastCtx)
