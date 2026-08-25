# Deploy Personal OS Web to Vercel

## Architecture

```
Browser
  → Vercel (vinext + Nitro)
    → same-origin /api/*
      → Railway backend (SoC-server)
```

Backend stays on Railway (`https://soc-server-production.up.railway.app`).  
This frontend no longer deploys via Cloudflare Workers / wrangler.

## Why Cloudflare was removed

Earlier Vercel deploys used `vinext build` with `@cloudflare/vite-plugin`. Build succeeded, but Vercel received a Workers-oriented artifact, so every route (`/`, `/calendar`, …) returned platform `404 NOT_FOUND`.

Production path is now:

- `vinext()` + `nitro()` in `vite.config.ts`
- `NITRO_PRESET=vercel` → Build Output API under `.vercel/output`

## Required env vars (Vercel → Project → Settings → Environment Variables)

| Key | Notes |
| --- | --- |
| `PLANNER_API_BASE_URL` | `https://soc-server-production.up.railway.app` (server-only) |
| `PLANNER_WEB_TOKEN` | Same ≥32-char token as Railway (server-only) |

Optional:

| Key | Notes |
| --- | --- |
| `PLANNER_WEB_PRIVATE_KEY` | Ed25519 PKCS#8 for ChatGPT Sites signing |
| `PLANNER_REQUIRE_CHATGPT_USER` | Set `1` only on ChatGPT Sites to require `oai-authenticated-*` headers |

Never use a `NEXT_PUBLIC_` prefix for tokens/keys.

## AI Goal Structuring proxy timeout

`POST /api/ai/goal-structure` waits up to **160s** for Railway (DeepSeek thinking).
The route sets `maxDuration = 180` for Vercel. Hobby plans cap functions at ~10s —
use **Pro** (or higher) so Goal Structuring can finish. Other `/api/*` proxies stay at 12s.

## Vercel dashboard settings

| Setting | Value |
| --- | --- |
| Root Directory | `.` (repo is `web/` only) or `web` if monorepo |
| Framework Preset | Other / leave auto |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | **leave empty** (Nitro writes `.vercel/output` Build Output API) |
| Node.js Version | **22.x** |

## Local commands

```bash
cd web
npm install
npm run dev                 # vinext HMR
npm run build               # Vercel artifact → .vercel/output
npm run build:node          # Node server → .output (local prod smoke)
npm start                   # node .output/server/index.mjs
npm run test:unit
npm test                    # unit + node prod SSR tests + vercel build
```

## Redeploy

Push to `main` on the connected GitHub repo, or:

```bash
cd web
npx vercel --prod
```

## Client hydration (vinext)

SSR can succeed while the UI looks “static” (sidebar clicks / Quick Add / Task Editor dead) if the vinext client bootstrap crashes.

**Required versions (lockfile):**

- `vinext` ≥ `1.0.0-beta.8` (fixes shim chunk grouping; see vinext #2794 / #2795)
- `@vitejs/plugin-rsc` ≥ `0.5.34` (peer of that vinext)

After a production build, `.vercel/output/static/_next/static/chunks/` must include a `vinext-*.js` chunk. If it is missing, client navigation will fail (e.g. `TypeError: e is not a function` inside `startTransition`, or RSC prefetch `m is not a function`).

When redeploying after this fix, use a **clean Vercel rebuild** (no stale build cache) so old client chunks are not mixed with new HTML.

## Common failures

| Symptom | Check |
| --- | --- |
| Platform 404 on all routes | Build must be Nitro Vercel (look for `.vercel/output/functions/__server.func` and `config.json` routes → `/__server`) |
| UI loads but clicks/nav dead | Upgrade vinext ≥ beta.8; confirm `vinext-*.js` in client chunks; clean redeploy |
| UI loads, data is demo/503 | `PLANNER_API_BASE_URL` / `PLANNER_WEB_TOKEN` missing or mismatched with Railway |
| 401 Sign in | `PLANNER_REQUIRE_CHATGPT_USER=1` set on standalone Vercel — turn it off |
| CSS / Tailwind build error | Keep `@import "tailwindcss/index.css"` (bare `tailwindcss` fails without CF plugin) |
