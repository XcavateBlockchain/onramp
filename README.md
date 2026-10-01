# tGBP Onramp

Mobile-webview website for minting and redeeming [tGBP](https://tgbp.io)
(GBP-pegged stablecoin) on **Solana**. Embedded in the Xcavate mobile app via a
webview; the app passes the user's identity and wallet as query parameters:

```
https://<host>/production/?sumsubId=<sumsub-applicant-id>&wallet=<solana-address>
https://<host>/staging/?sumsubId=<sumsub-applicant-id>&wallet=<solana-address>
```

The redemption (off-ramp) flow lives under `/redemption` with the same query
parameters:

```
https://<host>/production/redemption?sumsubId=<sumsub-applicant-id>&wallet=<solana-address>
```

## How it works

- **Nuxt 4 (Vue 3)** app with Nitro server routes acting as a backend-for-frontend.
  The tGBP API key lives only on the server — the webview client never sees it.
- Mint flow: resolve the `sumsubId` to the tGBP customer created by the
  [xcavate-sumsub-webhook](../xcavate-sumsub-webhook) service → register the wallet
  as a recipient address (`POST /api/v1/addresses/recipients`) → create the mint
  (`POST /api/v1/mints`) → show the bank transfer details → poll
  `GET /api/v1/mints/{id}` until the mint is `confirmed` / `failed`.
- Redemption flow (`/redemption`): resolve the customer the same way → pick or
  add a GBP payout bank account (`GET` / `POST /api/v1/banks`; new accounts stay
  `redemption_approved: false` until approved on the tGBP side) → register the
  wallet as a burn address (`POST /api/v1/addresses/burn`, skipped when already
  registered) and screen it (`POST /api/v1/redemptions/quote`) → create the
  redemption (`POST /api/v1/redemptions`). The user then burns the tGBP right
  from the page: connect any Solana browser wallet (Wallet Standard; Phantom,
  Solflare, …), the app builds the SPL transfer to the shared protocol
  `burnAddress` with `@solana/web3.js`, the wallet signs it, and the signature
  is handed to tGBP (`POST /api/v1/redemptions/{id}/burn-confirmation`) before
  polling `GET /api/v1/redemptions/{id}/with-payout-status` until `paid` /
  `failed`. When no browser wallet exists (the app webview), the page falls
  back to manual burn instructions. The burn source is the connected wallet —
  it is the address registered and screened at creation.
- Minting and redemption are **Solana-only**: `solana` on production,
  `solana-devnet` on staging. The browser-side burn works on both clusters via
  `NUXT_PUBLIC_SOLANA_CLUSTER` (+ optional `NUXT_PUBLIC_SOLANA_RPC_URL`). The
  burn transaction is rebuilt from the redemption's prebuilt
  `transaction_data.solana` instructions (authoritative); the fallback SPL
  transfer builder uses the tGBP mint resolved from the chain details
  (override with `NUXT_TGBP_MINT_ADDRESS`).

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
| `NUXT_PUBLIC_SOLANA_RPC_URL` | (optional) Solana RPC for the browser burn tx |
| `NUXT_TGBP_MINT_ADDRESS`    | (optional) override the tGBP mint address |

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

Server prerequisites: Docker with the compose plugin, and ports 80 and 443 open.
TLS is configured in `nginx/default.conf` for `onramp.xcavate.io`; certbot on the
host issues the cert and `fullchain.pem`/`privkey.pem` live in `nginx/certs/`
(excluded from git and from deploy rsync).

## Design

Visuals mirror `realXmarketMobileApp`: DM Sans, primary `#3B4F74`, accent pink
`#DC7DA6`, success `#357461`, 10px card radii, 24px pill buttons, subtle
`0 0 2px rgba(0,0,0,.16)` card shadow, brand gradient bar. Icons: Lucide.
