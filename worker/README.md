# Questboard Sync Worker

Cloudflare Worker + KV backend for encrypted Questboard sync.

## Endpoints

- `GET /healthz`
- `POST /v1/vaults`
- `GET /v1/vaults/:vaultId`
- `PUT /v1/vaults/:vaultId`

All `/v1/*` endpoints require `Authorization: Bearer <syncKey>`.

## Deploy

```bash
npm install
npx wrangler kv namespace create VAULTS
```

Set the KV namespace id in `wrangler.toml` and deploy:

```bash
npx wrangler deploy
```

## Environment vars

- `ALLOWED_ORIGINS` comma-separated CORS origins
- `RATE_LIMIT_PER_MINUTE` requests per minute per token hash
