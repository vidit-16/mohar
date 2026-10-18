import { type Hex, sha256, stringToBytes } from "viem"

// A small proof of work in front of the test-GLM drip: the server hands out a signed puzzle tied to one
// wallet address, the browser burns a second or two finding a nonce, and the server checks it statelessly.
// It doesn't prove a unique human; it makes draining the drip by script cost real CPU per wallet.
export type Challenge = { address: string; salt: Hex; exp: number; bits: number; sig: Hex }

export const powInput = (salt: Hex, address: string, nonce: number) => `${salt}:${address.toLowerCase()}:${nonce}`

export function zeroBits(hash: Uint8Array) {
  let n = 0
  for (const byte of hash) {
    if (byte === 0) {
      n += 8
      continue
    }
    return n + Math.clz32(byte) - 24
  }
  return n
}

export const solves = (c: Pick<Challenge, "salt" | "address" | "bits">, nonce: number) =>
  Number.isSafeInteger(nonce) && nonce >= 0 && zeroBits(sha256(stringToBytes(powInput(c.salt, c.address, nonce)), "bytes")) >= c.bits

// Works in slices and yields between them so the page stays responsive on a slow phone.
export async function solve(c: Pick<Challenge, "salt" | "address" | "bits">, slice = 5000): Promise<number> {
  for (let nonce = 0; ; ) {
    const end = nonce + slice
    for (; nonce < end; nonce++) if (solves(c, nonce)) return nonce
    await new Promise((r) => setTimeout(r, 0))
  }
}
