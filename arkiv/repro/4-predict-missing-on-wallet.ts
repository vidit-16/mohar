// friction #4: predictEntityKeys exists on the public client but not on the wallet client that needs it
import { reader, versions, wallet } from "./_wallet"

console.log(versions)
console.log("wallet.predictEntityKeys:", typeof (wallet as unknown as Record<string, unknown>).predictEntityKeys)
console.log("reader.predictEntityKeys:", typeof reader.predictEntityKeys)
