import { beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  vi.resetModules()
})

describe("browser wallets", () => {
  it("keeps the main wallet stable and gives witnesses their own", async () => {
    const { burner } = await import("../src/lib/burner")
    const main = burner().account!.address
    expect(burner("main").account!.address).toBe(main)
    expect(burner("witness").account!.address).not.toBe(main)
    expect(burner("witness").account!.address).toBe(burner("witness").account!.address)
  })

  it("retiring the witness wallet starts a new one, keeps the old key, and leaves the main wallet alone", async () => {
    const { burner, retireWitnessWallet } = await import("../src/lib/burner")
    const main = burner().account!.address
    const first = burner("witness").account!.address
    const firstKey = localStorage.getItem("mohar.witness")
    retireWitnessWallet()
    const second = burner("witness").account!.address
    expect(second).not.toBe(first)
    expect(burner().account!.address).toBe(main)
    expect(JSON.parse(localStorage.getItem("mohar.witness.used")!)).toEqual([firstKey])
    retireWitnessWallet()
    expect(JSON.parse(localStorage.getItem("mohar.witness.used")!)).toHaveLength(2)
  })

  it("survives a reload: the same stored key gives the same address", async () => {
    const a = (await import("../src/lib/burner")).burner("witness").account!.address
    vi.resetModules()
    const b = (await import("../src/lib/burner")).burner("witness").account!.address
    expect(b).toBe(a)
  })
})
