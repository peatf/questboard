import { hydrateQuestboardState, type QuestboardState } from './state'

interface EncryptedPayload {
  iv: string
  ciphertext: string
}

interface VaultPayload extends EncryptedPayload {
  revision: number
  updatedAt: number
}

interface CreateVaultResponse {
  vaultId: string
  revision: number
  updatedAt: number
}

interface PushVaultResponse {
  revision: number
  updatedAt: number
}

type PullResponse = VaultPayload

export interface SyncCredentials {
  vaultId: string
  syncKey: string
}

export interface CreateVaultResult extends SyncCredentials {
  revision: number
  serverUpdatedAt: number
}

export interface PushResult {
  revision: number
  serverUpdatedAt: number
}

export interface PullResult {
  state: QuestboardState
  revision: number
  updatedAt: number
}

export interface PushStateParams extends SyncCredentials {
  state: QuestboardState
  ifRevision: number | null
  apiBase?: string
}

export interface PullStateParams extends SyncCredentials {
  apiBase?: string
}

export interface CreateVaultParams {
  initialState: QuestboardState
  apiBase?: string
}

interface SyncHashPayload {
  vaultId: string
  syncKey: string
}

export class SyncApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'SyncApiError'
    this.status = status
    this.body = body
  }
}

export class SyncConflictError extends SyncApiError {
  readonly latestRevision: number
  readonly latestUpdatedAt: number

  constructor(message: string, status: number, body: unknown, latestRevision: number, latestUpdatedAt: number) {
    super(message, status, body)
    this.name = 'SyncConflictError'
    this.latestRevision = latestRevision
    this.latestUpdatedAt = latestUpdatedAt
  }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (normalized.length % 4)) % 4
  const padded = normalized + '='.repeat(padLength)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function ensureApiBase(apiBase?: string): string {
  const fromEnv = apiBase ?? import.meta.env.VITE_SYNC_API_BASE
  const normalized = (fromEnv ?? '').trim().replace(/\/$/, '')
  if (!normalized) {
    throw new Error('Missing sync API base URL. Set VITE_SYNC_API_BASE.')
  }
  return normalized
}

async function hashText(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return new Uint8Array(digest)
}

async function deriveAesKey(syncKey: string): Promise<CryptoKey> {
  const keyBytes = fromBase64Url(syncKey)
  const material = keyBytes.length >= 32 ? keyBytes.slice(0, 32) : await hashText(syncKey)
  return crypto.subtle.importKey('raw', material as unknown as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const errorText = typeof (body as { error?: unknown })?.error === 'string' ? (body as { error: string }).error : 'Sync request failed'
    if (response.status === 409) {
      const latestRevision =
        typeof (body as { latestRevision?: unknown })?.latestRevision === 'number'
          ? (body as { latestRevision: number }).latestRevision
          : 0
      const latestUpdatedAt =
        typeof (body as { latestUpdatedAt?: unknown })?.latestUpdatedAt === 'number'
          ? (body as { latestUpdatedAt: number }).latestUpdatedAt
          : Date.now()
      throw new SyncConflictError(errorText, response.status, body, latestRevision, latestUpdatedAt)
    }
    throw new SyncApiError(errorText, response.status, body)
  }

  return body as T
}

function authHeaders(syncKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${syncKey}`,
    'Content-Type': 'application/json',
  }
}

async function encryptPayload(state: QuestboardState, syncKey: string): Promise<EncryptedPayload> {
  const key = await deriveAesKey(syncKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = encoder.encode(JSON.stringify(state))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, plaintext as unknown as BufferSource)

  return {
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
  }
}

async function decryptPayload(payload: EncryptedPayload, syncKey: string): Promise<QuestboardState> {
  const key = await deriveAesKey(syncKey)
  const iv = fromBase64Url(payload.iv)
  const ciphertext = fromBase64Url(payload.ciphertext)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource,
  )
  const parsed: unknown = JSON.parse(decoder.decode(plaintext))
  return hydrateQuestboardState(parsed)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

export function createDeviceId(): string {
  return `qb-${crypto.randomUUID()}`
}

export function createSyncKey(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function encryptState(state: QuestboardState, syncKey: string): Promise<EncryptedPayload> {
  return encryptPayload(state, syncKey)
}

export async function decryptState(payload: EncryptedPayload, syncKey: string): Promise<QuestboardState> {
  return decryptPayload(payload, syncKey)
}

export function getSyncLink(vaultId: string, syncKey: string): string {
  const { origin, pathname, search } = window.location
  const hashValue = encodeURIComponent(`${vaultId}.${syncKey}`)
  return `${origin}${pathname}${search}#sync=${hashValue}`
}

export function parseSyncHash(hash: string): SyncHashPayload | null {
  const input = hash.startsWith('#') ? hash.slice(1) : hash
  if (!input) {
    return null
  }

  const pairs = new URLSearchParams(input)
  const syncRaw = pairs.get('sync')
  if (!syncRaw) {
    return null
  }

  const decoded = decodeURIComponent(syncRaw)
  const split = decoded.indexOf('.')
  if (split <= 0 || split >= decoded.length - 1) {
    return null
  }

  const vaultId = decoded.slice(0, split).trim()
  const syncKey = decoded.slice(split + 1).trim()
  if (!vaultId || !syncKey) {
    return null
  }

  return { vaultId, syncKey }
}

export function clearSyncHash(): void {
  const nextUrl = `${window.location.pathname}${window.location.search}`
  window.history.replaceState({}, document.title, nextUrl)
}

export async function createVault({ initialState, apiBase }: CreateVaultParams): Promise<CreateVaultResult> {
  const endpoint = ensureApiBase(apiBase)
  const syncKey = createSyncKey()
  const encrypted = await encryptPayload(initialState, syncKey)

  const response = await fetch(`${endpoint}/v1/vaults`, {
    method: 'POST',
    headers: authHeaders(syncKey),
    body: JSON.stringify(encrypted),
  })

  const body = await parseJsonOrThrow<CreateVaultResponse>(response)
  return {
    vaultId: body.vaultId,
    syncKey,
    revision: body.revision,
    serverUpdatedAt: body.updatedAt,
  }
}

export async function pullState({ vaultId, syncKey, apiBase }: PullStateParams): Promise<PullResult> {
  const endpoint = ensureApiBase(apiBase)
  const response = await fetch(`${endpoint}/v1/vaults/${encodeURIComponent(vaultId)}`, {
    method: 'GET',
    headers: authHeaders(syncKey),
  })

  const body = await parseJsonOrThrow<PullResponse>(response)
  const state = await decryptPayload({ iv: body.iv, ciphertext: body.ciphertext }, syncKey)
  return {
    state,
    revision: body.revision,
    updatedAt: body.updatedAt,
  }
}

export async function pushState({ state, vaultId, syncKey, ifRevision, apiBase }: PushStateParams): Promise<PushResult> {
  const endpoint = ensureApiBase(apiBase)
  const encrypted = await encryptPayload(state, syncKey)

  let attempts = 0
  while (attempts < 3) {
    attempts += 1

    try {
      const response = await fetch(`${endpoint}/v1/vaults/${encodeURIComponent(vaultId)}`, {
        method: 'PUT',
        headers: authHeaders(syncKey),
        body: JSON.stringify({
          ...encrypted,
          ifRevision,
        }),
      })

      const body = await parseJsonOrThrow<PushVaultResponse>(response)
      return {
        revision: body.revision,
        serverUpdatedAt: body.updatedAt,
      }
    } catch (error) {
      if (error instanceof SyncConflictError) {
        throw error
      }
      const isFinalAttempt = attempts >= 3
      if (isFinalAttempt) {
        throw error
      }
      await delay(200 * attempts)
    }
  }

  throw new Error('Sync push failed after retries')
}
