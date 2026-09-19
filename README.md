# tGBP Onramp

Mobile-webview website for minting [tGBP](https://tgbp.io) (GBP-pegged stablecoin)
on **Solana**. Embedded in the Xcavate mobile app via a webview; the app passes the
user's identity and wallet as query parameters:

```
https://<host>/production/?sumsubId=<sumsub-applicant-id>&wallet=<solana-address>
https://<host>/staging/?sumsubId=<sumsub-applicant-id>&wallet=<solana-address>
```

## How it works

- **Nuxt 4 (Vue 3)** app with Nitro server routes acting as a backend-for-frontend.
  The tGBP API key lives only on the server — the webview client never sees it.
- Flow: resolve the `sumsubId` to the tGBP customer created by the
  [xcavate-sumsub-webhook](../xcavate-sumsub-webhook) service → register the wallet
  as a recipient address (`POST /api/v1/addresses/recipients`) → create the mint
  (`POST /api/v1/mints`) → show the bank transfer details → poll
  `GET /api/v1/mints/{id}` until the mint is `confirmed` / `failed`.
- Minting is **Solana-only**: `solana` on production, `solana-devnet` on staging.

## Environments

| Path         | tGBP API                | Chain           | API key prefix    |
| ------------ | ----------------------- | --------------- | ----------------- |
| `/staging/`  | `https://sandbox.tgbp.io` | `solana-devnet` | `tgbp_sandbox_`   |
| `/production/` | `https://api.tgbp.io`     | `solana`        | `tgbp_live_`      |

Both variants run from the same Docker image; the difference is runtime env:

| Variable                    | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| `NUXT_TGBP_API_KEY`         | tGBP API key (server-only)                |
| `NUXT_TGBP_API_BASE_URL`    | tGBP API base URL (server-only)           |
| `NUXT_TGBP_CHAIN`           | Chain id: `solana` / `solana-devnet`      |
| `NUXT_PUBLIC_ENV_NAME`      | `staging` / `production` (UI badge)       |
| `NUXT_PUBLIC_SOLANA_CLUSTER`| `devnet` / `mainnet` (explorer links)     |
| `NUXT_APP_BASE_URL`         | `/staging/` / `/production/` (set in compose) |
| `NITRO_PORT` / `NITRO_HOST` | listener config (set in compose)          |

## Local development

```bash
npm install
cp .env.example .env        # fill in NUXT_TGBP_API_KEY
npm run dev                 # http://localhost:3000
```

## Deployment (Hetzner via GitHub Actions)

Push to `main` (or *Run workflow*) triggers `.github/workflows/deploy.yml`, which
rsyncs the repo to `/opt/onramp` on the server, writes `.env.staging` /
`.env.production` from repository secrets, and runs `docker compose up -d --build`.
nginx proxies `/staging/` → container :3001 and `/production/` → container :3002.

Required repository secrets:

| Secret                  | Value                                    |
| ----------------------- | ---------------------------------------- |
| `HETZNER_HOST`          | server IP/hostname                       |
| `HETZNER_USER`          | SSH user                                 |
| `HETZNER_SSH_KEY`       | SSH private key for that user            |
| `HETZNER_SSH_PORT`      | (optional, default 22)                   |
| `TGBP_API_KEY_STAGING`  | sandbox key (`tgbp_sandbox_…`)           |
| `TGBP_API_KEY_PRODUCTION` | live key (`tgbp_live_…`)               |

Server prerequisites: Docker with the compose plugin, and ports 80 (and 443 for
TLS) open. TLS: drop `fullchain.pem`/`privkey.pem` into `nginx/certs` and enable
the commented HTTPS server block in `nginx/default.conf` (plus port 443 in
`docker-compose.yml`).

## Design

Visuals mirror `realXmarketMobileApp`: DM Sans, primary `#3B4F74`, accent pink
`#DC7DA6`, success `#357461`, 10px card radii, 24px pill buttons, subtle
`0 0 2px rgba(0,0,0,.16)` card shadow, brand gradient bar. Icons: Lucide.
