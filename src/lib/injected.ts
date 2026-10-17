import { createWalletClient, type WalletArkivClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { type Address, custom, type EIP1193Provider } from "viem"

type Eth = EIP1193Provider & { isMetaMask?: boolean }
const eth = () => (globalThis as { ethereum?: Eth }).ethereum

export const hasInjectedWallet = () => !!eth()

// MetaMask (or any injected wallet, incl. hardware wallets behind it), switched to Tiramisu
export async function connectInjected(): Promise<WalletArkivClient> {
  const provider = eth()
  if (!provider) throw new Error("No browser wallet found. Install MetaMask, or use this browser's wallet.")
  const [account] = (await provider.request({ method: "eth_requestAccounts" })) as Address[]
  const chainId = `0x${tiramisu.id.toString(16)}` as const
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] })
  } catch {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId, chainName: "Arkiv Tiramisu", nativeCurrency: tiramisu.nativeCurrency, rpcUrls: [...tiramisu.rpcUrls.default.http], blockExplorerUrls: ["https://tiramisu.explorer.arkiv.network"] }],
    })
  }
  return createWalletClient({ chain: tiramisu, transport: custom(provider), account })
}
