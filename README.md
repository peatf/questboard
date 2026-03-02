# Questboard

Retro-styled weekly check-in app inspired by classic Mac OS 8/9 window chrome and JRPG command menus.

## Tech

- Vite
- React
- TypeScript
- GitHub Pages via GitHub Actions
- Optional Cloudflare Worker + KV for encrypted sync

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Sync setup (optional)

Cloud sync is local-first and encrypted in the browser before upload.

1. Copy `.env.example` to `.env.local`.
2. Set:
   - `VITE_SYNC_ENABLED=true`
   - `VITE_SYNC_API_BASE=https://<your-worker>.workers.dev`
3. Start app with `npm run dev`.

### Worker deployment

```bash
cd worker
npm install
npx wrangler kv namespace create VAULTS
```

Update `worker/wrangler.toml` with the returned KV namespace id, then deploy:

```bash
npx wrangler deploy
```
