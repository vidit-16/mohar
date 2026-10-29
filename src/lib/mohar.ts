import {
  createPublicClient,
  type Entity,
  ExpirationTime,
  jsonToPayload,
  type PublicArkivClient,
  type WalletArkivClient,
} from "@arkiv-network/sdk"
import { bytes32, i32, str, u64 } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { and, eq, gte } from "@arkiv-network/sdk/query"
import { type Address, fallback, type Hex, http, webSocket } from "viem"
import { commitHash, questionHash, randomSalt, rootHash, splitQuestions } from "./hash"
import { type CommitPayload, type ExamSpec, newOpenExamId, type OpenExamPayload, packBatches, type RevealPayload, type Row, type SealSecrets, type WitnessPayload } from "./rules"

export * from "./rules"

export const PROJECT = "mohar-v1"
export const BURN: Address = "0x000000000000000000000000000000000000dEaD"
export const DAY_MS = 24 * 60 * 60 * 1000

export const ISSUERS: Record<string, string> = {
  "0x6A473f5cE4AfB5acC58a56C4988b1fCb7A5E36A6": "Demo State Public Service Commission",
}

const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {}
const nodeEnv = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const KEY = viteEnv.VITE_ARKIV_KEY || nodeEnv.ARKIV_KEY
export const RPC_URL = KEY ? `${tiramisu.rpcUrls.default.http[0]}/${KEY}` : undefined

// The deployed site reads through its own /api/rpc proxy (key stays server-side) and falls back to
// the public RPC if that's down, so the site never depends on our proxy to show the evidence.
// The GitHub Pages mirror is built with VITE_STATIC=1: no functions there, so it reads the RPC directly.
export const viaProxy = Boolean((import.meta as { env?: { PROD?: boolean } }).env?.PROD) && !viteEnv.VITE_STATIC && typeof window !== "undefined"

export function publicClient(rpc = RPC_URL): PublicArkivClient {
  // retryCount 0: on a keyless 429 viem would otherwise sit on a ~40 min Retry-After without telling anyone
  const direct = http(rpc, { retryCount: 0 })
  return createPublicClient({ chain: tiramisu, transport: viaProxy ? fallback([http("/api/rpc", { retryCount: 0 }), direct], { retryCount: 0 }) : direct })
}

// A version string for one exam from the site's 2s-cached /api/status; it changes whenever a record is added.
export async function examVersion(examId: string): Promise<string | undefined> {
  const res = await fetch(`/api/status?exam=${encodeURIComponent(examId)}`)
  if (!res.ok) return undefined
  return ((await res.json()) as { version?: string }).version
}

export function liveClient(): PublicArkivClient {
  // watchEntityEvents only pushes over a websocket (and without fromBlock); over http it silently polls
  return createPublicClient({ chain: tiramisu, transport: webSocket() })
}

const graceExpiry = (opensAtMs: number, days: number) =>
  ExpirationTime.atDate(new Date(opensAtMs + days * DAY_MS), { atLeast: ExpirationTime.fromDays(14) })


type Create = Parameters<WalletArkivClient["executeBatch"]>[0]["creates"] extends (infer C)[] | undefined ? C : never

// Creates entities in as few transactions as fit (see packBatches), each one handing its entities to a dead
// address in the same tx: readonly still lets the owner delete, so ownership is burned straight away.
async function createBurned(wallet: WalletArkivClient, creates: Omit<Create, "salt">[], label: (i: number) => string) {
  const owner = wallet.account!.address
  const batches = packBatches(
    creates.map((c, i) => ({ c, i })),
    ({ c }) => c.payload?.length ?? 0,
    undefined,
    ({ i }) => label(i),
  )
  const txHashes: Hex[] = []
  for (const batch of batches) {
    const keys = await publicClient().predictEntityKeys({ owner, count: batch.length })
    const res = await wallet.executeBatch({
      creates: batch.map(({ c }, j) => ({ ...c, salt: keys[j].salt }) as Create),
      ownershipChanges: keys.map((k) => ({ entityKey: k.key, newOwner: BURN })),
    })
    txHashes.push(res.txHash)
  }
  return { txHash: txHashes[0], txHashes }
}

export async function sealExam(wallet: WalletArkivClient, spec: ExamSpec) {
  const secrets: SealSecrets = { examId: spec.examId, sets: [] }
  const creates = spec.sets.map((set) => {
    const salts = set.questions.map(() => randomSalt())
    secrets.sets.push({ code: set.code, salts, questions: set.questions })
    const commits = set.questions.map((q, j) => commitHash(salts[j], q))
    return {
      payload: jsonToPayload({ v: 1, title: spec.title, commits } satisfies CommitPayload),
      contentType: "application/json" as const,
      attributes: {
        project: str(PROJECT),
        type: str("paper_commit"),
        exam_id: str(spec.examId),
        shift: i32(spec.shift),
        set_code: str(set.code),
        opens_at_ms: u64(spec.opensAtMs),
        n_q: i32(set.questions.length),
        root: bytes32(rootHash(commits)),
      },
      expires: graceExpiry(spec.opensAtMs, 30),
      flags: { readonly: true, permissionlessExtension: true },
    }
  })
  return { ...(await createBurned(wallet, creates, (i) => spec.sets[i].code)), secrets }
}

export async function revealExam(wallet: WalletArkivClient, secrets: SealSecrets, opensAtMs: number) {
  const creates = secrets.sets.map((set) => ({
    payload: jsonToPayload({ v: 1, salts: set.salts, questions: set.questions } satisfies RevealPayload),
    contentType: "application/json" as const,
    attributes: {
      project: str(PROJECT),
      type: str("reveal"),
      exam_id: str(secrets.examId),
      set_code: str(set.code),
      root: bytes32(rootHash(set.questions.map((q, j) => commitHash(set.salts[j], q)))),
    },
    expires: graceExpiry(opensAtMs, 30),
    flags: { readonly: true, permissionlessExtension: true },
  }))
  // usually one transaction; a many-language paper goes out in back-to-back ones, and verdicts use the earliest
  return createBurned(wallet, creates, (i) => secrets.sets[i].code)
}

export async function createOpenExam(wallet: WalletArkivClient, input: { title: string; opensAtMs: number; notice?: string }) {
  const examId = newOpenExamId(input.title)
  const res = await wallet.createEntity({
    payload: jsonToPayload({ v: 1, title: input.title, notice: input.notice || undefined } satisfies OpenExamPayload),
    contentType: "application/json",
    attributes: {
      project: str(PROJECT),
      type: str("open_exam"),
      exam_id: str(examId),
      opens_at_ms: u64(input.opensAtMs),
    },
    expires: graceExpiry(input.opensAtMs, 60),
    flags: { readonly: true, permissionlessExtension: true },
  })
  return { ...res, examId }
}

export async function witnessPaper(wallet: WalletArkivClient, examId: string, paper: string) {
  const hashes = splitQuestions(paper).map(questionHash)
  if (hashes.length === 0) throw new Error("Paste at least one question")
  return wallet.createEntity({
    payload: jsonToPayload({ v: 1, hashes } satisfies WitnessPayload),
    contentType: "application/json",
    attributes: {
      project: str(PROJECT),
      type: str("witness"),
      exam_id: str(examId),
      n_q: i32(hashes.length),
    },
    expires: ExpirationTime.fromDays(14),
    flags: { readonly: true, permissionlessExtension: true },
  })
}

export async function keepAlive(wallet: WalletArkivClient, entityKey: Hex, currentExpiresAt: bigint, days = 14) {
  // extendEntity(fromDays(n)) means "n days from now", not "+n days", so build the target block ourselves
  const { blockDuration } = await publicClient().getBlockTiming()
  const target = currentExpiresAt + BigInt(Math.round((days * 86_400) / blockDuration))
  return wallet.extendEntity({ entityKey, expires: ExpirationTime.atBlock(target) })
}


const FIELDS = {
  key: true,
  creator: true,
  owner: true,
  createdAt: true,
  expiresAt: true,
  creationFlags: true,
  attributes: true,
  payload: true,
} as const

function toRow(e: Entity): Row {
  const attrs: Row["attrs"] = {}
  for (const [k, v] of Object.entries(e.attributes ?? {})) attrs[k] = v.value as Row["attrs"][string]
  let json: unknown = null
  try {
    json = e.toJson()
  } catch {
    json = null
  }
  return {
    key: e.key!,
    creator: e.creator!,
    owner: e.owner!,
    createdAt: e.createdAt!,
    expiresAt: e.expiresAt!,
    readonly: !!e.creationFlags?.readonly,
    extendable: !!e.creationFlags?.permissionlessExtension,
    attrs,
    json,
  }
}

const base = (type: string) => [eq("project", str(PROJECT)), eq("type", str(type))]

async function rows(client: PublicArkivClient, where: ReturnType<typeof and>, creator?: Address) {
  let q = client.select(FIELDS).where(where).limit(200)
  if (creator) q = q.createdBy(creator)
  const res = await q.fetch()
  return res.entities.map((e) => toRow(e as unknown as Entity))
}

export const commitsFor = (client: PublicArkivClient, examId: string) =>
  rows(client, and([...base("paper_commit"), eq("exam_id", str(examId))]))

export const examsFrom = (client: PublicArkivClient, issuer: Address, sinceMs: number) =>
  rows(client, and([...base("paper_commit"), gte("opens_at_ms", u64(sinceMs))]), issuer)

export const revealsFor = (client: PublicArkivClient, examId: string, issuer: Address) =>
  rows(client, and([...base("reveal"), eq("exam_id", str(examId))]), issuer)

export const openExamsSince = (client: PublicArkivClient, sinceMs: number) =>
  rows(client, and([...base("open_exam"), gte("opens_at_ms", u64(sinceMs))]))

export const openExamEntries = (client: PublicArkivClient, examId: string) =>
  rows(client, and([...base("open_exam"), eq("exam_id", str(examId))]))

// Seals, reveals, open-exam entries and witnesses all carry exam_id, so one query loads a whole exam page.
// Trust is still decided by $creator afterwards; the keyless read budget is only ~100 queries per IP.
export async function examRecords(client: PublicArkivClient, examId: string, cursor?: string) {
  let q = client.select(FIELDS).where(and([eq("project", str(PROJECT)), eq("exam_id", str(examId))])).limit(200)
  if (cursor) q = q.cursor(cursor)
  const res = await q.fetch()
  const all = res.entities.map((e) => toRow(e as unknown as Entity))
  const of = (type: string) => all.filter((r) => r.attrs.type === type)
  return {
    commits: of("paper_commit"),
    reveals: of("reveal"),
    entries: of("open_exam"),
    witnesses: of("witness"),
    next: res.hasNextPage() ? res.cursor : undefined,
  }
}

export async function witnessesFor(client: PublicArkivClient, examId: string, cursor?: string) {
  let q = client
    .select(FIELDS)
    .where(and([...base("witness"), eq("exam_id", str(examId))]))
    .limit(50)
  if (cursor) q = q.cursor(cursor)
  const res = await q.fetch()
  return {
    rows: res.entities.map((e) => toRow(e as unknown as Entity)),
    next: res.hasNextPage() ? res.cursor : undefined,
  }
}


const blockTimes = new Map<bigint, number>()
export async function blockTimeMs(client: PublicArkivClient, block: bigint): Promise<number> {
  const hit = blockTimes.get(block)
  if (hit !== undefined) return hit
  const b = await client.getBlock({ blockNumber: block })
  const ms = Number(b.timestamp) * 1000
  blockTimes.set(block, ms)
  return ms
}

export const QUERIES = {
  commits: (examId: string) => and([...base("paper_commit"), eq("exam_id", str(examId))]).toString(),
  reveals: (examId: string) => and([...base("reveal"), eq("exam_id", str(examId))]).toString(),
  openExam: (examId: string) => and([...base("open_exam"), eq("exam_id", str(examId))]).toString(),
  everything: (examId: string) => and([eq("project", str(PROJECT)), eq("exam_id", str(examId))]).toString(),
  witnesses: (examId: string) => and([...base("witness"), eq("exam_id", str(examId))]).toString(),
}
