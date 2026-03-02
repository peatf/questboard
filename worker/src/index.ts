interface Env {
  VAULTS: KVNamespace
  ALLOWED_ORIGINS?: string
  RATE_LIMIT_PER_MINUTE?: string
}

interface VaultRecord {
  syncKeyHash: string
  iv: string
  ciphertext: string
  revision: number
  updatedAt: number
}

interface VaultRequestBody {
  iv?: unknown
  ciphertext?: unknown
  ifRevision?: unknown
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers ?? {}),
    },
  })
}

function getAllowedOrigins(env: Env): string[] {
  const configured = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173']
  return [...defaults, ...configured]
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers()
  const origin = request.headers.get('Origin')
  if (!origin) {
    return headers
  }

  const allowedOrigins = getAllowedOrigins(env)
  const githubPagesOrigin = /^https:\/\/[a-z0-9-]+\.github\.io$/i
  const allowed = allowedOrigins.includes(origin) || githubPagesOrigin.test(origin)

  if (allowed) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
  }

  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  return headers
}

function withCors(response: Response, cors: Headers): Response {
  const headers = new Headers(response.headers)
  cors.forEach((value, key) => headers.set(key, value))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization')
  if (!authorization) {
    return null
  }
  const [scheme, token] = authorization.split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }
  return token.trim()
}

function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

async function hashSecret(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return encodeHex(new Uint8Array(digest))
}

function vaultKey(vaultId: string): string {
  return `vault:${vaultId}`
}

function rateLimitKey(identity: string): string {
  const minute = Math.floor(Date.now() / 60000)
  return `rl:${identity}:${minute}`
}

async function applyRateLimit(env: Env, identity: string): Promise<boolean> {
  const limit = Number(env.RATE_LIMIT_PER_MINUTE ?? 120)
  if (!Number.isFinite(limit) || limit <= 0) {
    return true
  }

  const key = rateLimitKey(identity)
  const currentRaw = await env.VAULTS.get(key)
  const current = Number(currentRaw ?? '0')
  if (Number.isFinite(current) && current >= limit) {
    return false
  }

  await env.VAULTS.put(key, String((Number.isFinite(current) ? current : 0) + 1), {
    expirationTtl: 120,
  })
  return true
}

function isVaultBody(body: VaultRequestBody): body is Required<Pick<VaultRequestBody, 'iv' | 'ciphertext'>> {
  return typeof body.iv === 'string' && body.iv.length > 0 && typeof body.ciphertext === 'string' && body.ciphertext.length > 0
}

async function parseBody(request: Request): Promise<VaultRequestBody | null> {
  try {
    const data: unknown = await request.json()
    if (typeof data !== 'object' || data === null) {
      return null
    }
    return data as VaultRequestBody
  } catch {
    return null
  }
}

function parseVaultId(url: URL): string | null {
  const match = url.pathname.match(/^\/v1\/vaults\/([^/]+)$/)
  if (!match) {
    return null
  }
  return decodeURIComponent(match[1])
}

async function getVaultRecord(env: Env, vaultId: string): Promise<VaultRecord | null> {
  const raw = await env.VAULTS.get(vaultKey(vaultId))
  if (!raw) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const value = parsed as Record<string, unknown>
    if (
      typeof value.syncKeyHash !== 'string' ||
      typeof value.iv !== 'string' ||
      typeof value.ciphertext !== 'string' ||
      typeof value.revision !== 'number' ||
      typeof value.updatedAt !== 'number'
    ) {
      return null
    }

    return {
      syncKeyHash: value.syncKeyHash,
      iv: value.iv,
      ciphertext: value.ciphertext,
      revision: value.revision,
      updatedAt: value.updatedAt,
    }
  } catch {
    return null
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const cors = corsHeaders(request, env)
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), cors)
    }

    const url = new URL(request.url)

    if (url.pathname === '/healthz') {
      return withCors(
        json({ ok: true, now: Date.now() }, {
          status: 200,
        }),
        cors,
      )
    }

    const syncKey = getBearerToken(request)
    if (!syncKey) {
      return withCors(json({ error: 'Missing bearer token' }, { status: 401 }), cors)
    }

    const syncKeyHash = await hashSecret(syncKey)

    const canProceed = await applyRateLimit(env, syncKeyHash)
    if (!canProceed) {
      return withCors(json({ error: 'Rate limit exceeded' }, { status: 429 }), cors)
    }

    if (url.pathname === '/v1/vaults' && request.method === 'POST') {
      const body = await parseBody(request)
      if (!body || !isVaultBody(body)) {
        return withCors(json({ error: 'Invalid payload' }, { status: 400 }), cors)
      }

      const vaultId = crypto.randomUUID()
      const now = Date.now()
      const record: VaultRecord = {
        syncKeyHash,
        iv: body.iv,
        ciphertext: body.ciphertext,
        revision: 1,
        updatedAt: now,
      }

      await env.VAULTS.put(vaultKey(vaultId), JSON.stringify(record))

      return withCors(
        json(
          {
            vaultId,
            revision: record.revision,
            updatedAt: record.updatedAt,
          },
          { status: 201 },
        ),
        cors,
      )
    }

    const vaultId = parseVaultId(url)
    if (!vaultId) {
      return withCors(json({ error: 'Not found' }, { status: 404 }), cors)
    }

    const record = await getVaultRecord(env, vaultId)
    if (!record) {
      return withCors(json({ error: 'Vault not found' }, { status: 404 }), cors)
    }

    if (record.syncKeyHash !== syncKeyHash) {
      return withCors(json({ error: 'Unauthorized for this vault' }, { status: 403 }), cors)
    }

    if (request.method === 'GET') {
      return withCors(
        json({
          iv: record.iv,
          ciphertext: record.ciphertext,
          revision: record.revision,
          updatedAt: record.updatedAt,
        }),
        cors,
      )
    }

    if (request.method !== 'PUT') {
      return withCors(json({ error: 'Method not allowed' }, { status: 405 }), cors)
    }

    const body = await parseBody(request)
    if (!body || !isVaultBody(body)) {
      return withCors(json({ error: 'Invalid payload' }, { status: 400 }), cors)
    }

    const ifRevision = typeof body.ifRevision === 'number' ? body.ifRevision : null
    if (ifRevision !== null && ifRevision !== record.revision) {
      return withCors(
        json(
          {
            error: 'Revision conflict',
            latestRevision: record.revision,
            latestUpdatedAt: record.updatedAt,
          },
          { status: 409 },
        ),
        cors,
      )
    }

    const nextRecord: VaultRecord = {
      ...record,
      iv: body.iv,
      ciphertext: body.ciphertext,
      revision: record.revision + 1,
      updatedAt: Date.now(),
    }

    await env.VAULTS.put(vaultKey(vaultId), JSON.stringify(nextRecord))

    return withCors(
      json({
        revision: nextRecord.revision,
        updatedAt: nextRecord.updatedAt,
      }),
      cors,
    )
  },
} satisfies ExportedHandler<Env>
