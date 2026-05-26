# PayIn Cloud Layer — Deployable Web3 Payment Platform on PayIn Open

**PayIn Cloud Layer** is a hosted payment platform layer for teams that want a Stripe-like operating console for Web3 payments: payment orders, deposit addresses, tenant control, admin UI, webhook proof flows, and Railway-ready deployment — while keeping the payment core composed from **PayIn Open** instead of copying or forking it.

If you are searching for **Web3 payment gateway**, **crypto payment API**, **USDC payment links**, **on-chain deposit management**, **Railway Web3 deployment**, or **self-hosted crypto payment infrastructure**, this project is the PayIn Cloud overlay that turns the PayIn Open core into a deployable SaaS-style payment service.

---

## Why this matters

Most crypto payment products force a hard choice:

- use a hosted third-party processor and lose control;
- fork an open-source payment core and inherit long-term maintenance risk;
- or build your own dashboard, tenant model, webhook system, deployment pipeline, and operational runbooks from scratch.

PayIn Cloud Layer is the middle path.

It adds the business-facing cloud experience around PayIn Open — admin screens, proof-mode login, organization context, address-pool operations, payment order flows, deposit reference flows, webhook delivery proofs, and hosted deployment wiring — without duplicating the Open payment engine.

In plain language: **PayIn Open handles the payment foundation; PayIn Cloud Layer makes it easier to operate, demo, deploy, and evolve as a cloud product.**

---

## What you can do with it today

This repository currently supports a Railway-hosted sandbox/proof deployment and deterministic local tests.

You can:

- deploy a PayIn Cloud Layer service to Railway;
- open the Cloud admin UI at `/admin`;
- create and inspect proof-mode payment orders;
- bind deposit references to generated blockchain addresses;
- simulate webhook delivery without calling real providers;
- run repeatable e2e checks for both `order` and `deposit` business flows;
- validate that Cloud-owned code composes PayIn Open through stable seams.

Current proof-mode coverage includes:

| Area | Covered |
| --- | --- |
| Admin/API auth | Demo login, session cookie, organization context |
| Order flow | Create order, list, detail, stats, hosted payment page, proof webhook, linked transfer |
| Deposit flow | Bind deposit reference, list/references, stats, proof webhook, linked transfer |
| Notifications | Webhook endpoint creation, redacted secret handling, simulated delivery logs |
| Safety | No `.env*` reads, no real provider calls, no mainnet calls, no copied PayIn Open payment internals |

> Important: proof-mode webhooks are intentionally simulated. This is a deployment and business-flow proof, not a mainnet settlement system.

---

## Architecture in one minute

```text
PayIn Cloud Layer
├─ Cloud admin UI                 /admin
├─ Cloud-owned control plane       /api/v1/cloud-layer/*
├─ Proof-mode hosted business APIs /api/v1/orders, /api/v1/deposits, /api/v1/notifications
├─ Railway deployment config       railway.json + nixpacks.toml at monorepo root
└─ PayIn Open composition seam      @payin/app/server, @payin/app/runtime-contract

PayIn Open
└─ Payment core, API foundation, runtime contract
```

The Cloud Layer depends on PayIn Open through the local package dependency:

```json
"@payin/app": "file:../payin-open/apps/api"
```

That means deployment must include both folders:

```text
payincom/
├─ payin-open/
├─ payin-cloud-layer/
├─ package.json
├─ railway.json
└─ nixpacks.toml
```

Deploying only `payin-cloud-layer/` will fail because Railway cannot resolve the sibling `payin-open` dependency. Deploy from the **monorepo root** (`payincom/`).

---

## Quick start: run locally

Prerequisites:

- Node.js 22+
- npm 10+
- this workspace layout: `payin-open/` next to `payin-cloud-layer/`

```sh
cd payincom/payin-cloud-layer
npm ci --legacy-peer-deps --include=dev
npm --prefix ../payin-open install --legacy-peer-deps --include=dev
npm run validate
npm start
```

Open:

```text
http://localhost:3000/admin
```

For the local Cloud admin shell:

1. Visit `/admin`.
2. Go to the login screen.
3. Choose **Enter Local Cloud Layer Shell**.
4. Inspect the Cloud control-plane panel.

---

## Quick deploy to Railway

This is the fastest repeatable path to a hosted sandbox.

### 1. Install and log in to Railway CLI

```sh
npm install -g @railway/cli
railway login
```

If you already have the CLI installed in a custom user-tools path, use that binary instead.

### 2. Link the Railway project/service

From the monorepo root:

```sh
cd payincom
railway link
railway status
```

Confirm Railway shows the target service, for example:

```text
Service: cloud-runtime
Environment: production
URL: https://<your-service>.up.railway.app
```

### 3. Deploy from the monorepo root

```sh
cd payincom
railway deployment up --detach --message "Deploy PayIn Cloud Layer"
```

Why root? The root contains `railway.json`, `nixpacks.toml`, `payin-open/`, and `payin-cloud-layer/`. Railway needs all of them to build the composed service.

### 4. Wait for the deployment to become healthy

```sh
railway deployment list
railway status
```

A successful deployment should show:

```text
cloud-runtime: Online
```

The service uses the root-level deployment config:

- `railway.json` sets build/start/healthcheck behavior;
- `nixpacks.toml` installs both `payin-open` and `payin-cloud-layer` dependencies;
- root `package.json` builds PayIn Open first, then validates/builds the Cloud Layer;
- root `npm start` starts `payin-cloud-layer` with `HOST=0.0.0.0`.

### 5. Open the hosted admin UI

```text
https://<your-service>.up.railway.app/admin
```

For the current sandbox shape, demo login defaults are proof-mode credentials configured by the app unless overridden by platform variables:

```text
admin@example.com
payin-demo-password
```

Do not put real production secrets in frontend `VITE_*` variables. Treat all `VITE_*` values as public browser config.

---

## Verify the hosted deployment

After Railway is online, run the hosted business e2e test from `payin-cloud-layer/`:

```sh
cd payincom/payin-cloud-layer
BASE_URL=https://<your-service>.up.railway.app npm run hosted:business:e2e
```

Expected final line:

```text
hosted-business-e2e: passed Railway hosted redacted login, address seeding, order create/list/detail/stats/page/proof, deposit bind/references/list/stats/proof, and linked transfer checks
```

This test performs real HTTP requests against the hosted Railway service. It verifies:

1. proof-mode login and session cookie;
2. organization/session context;
3. chain and token discovery;
4. address-pool seeding;
5. order creation, listing, detail, stats, hosted payment page, proof webhook, linked transfer;
6. deposit binding, references, listing, stats, proof webhook, linked transfer;
7. notification endpoint creation with redacted signing secret;
8. simulated webhook delivery logs.

The script intentionally redacts token, cookie, password, signing-secret, and key-like fields in its output.

---

## Local e2e and validation commands

Use these commands when changing code:

```sh
cd payincom/payin-cloud-layer

# Full local validation: Open build, Cloud type-check/build, admin build, contract guard, safety scan
npm run validate

# Local in-memory order + deposit business e2e
npm run smoke:business:e2e

# Hosted Railway order + deposit business e2e
BASE_URL=https://<your-service>.up.railway.app npm run hosted:business:e2e
```

Useful focused smoke checks:

```sh
npm run smoke:r11      # deposit/reference proof coverage
npm run smoke:r12      # order/payment-page proof coverage
npm run smoke:policy   # Cloud policy boundary proof
```

---

## Environment and secret policy

This repository is designed to keep deployment secrets out of source control.

Do:

- store real secrets in Railway variables or another secret manager;
- keep `DATABASE_URL`, session secrets, provider API keys, webhook secrets, and private keys out of git;
- use `VITE_*` only for public browser routing/config;
- run migrations only in environments where `DATABASE_URL` is explicitly configured.

Do not:

- commit `.env*` files;
- print raw bearer tokens, cookies, private keys, or webhook signing secrets in logs;
- deploy from `payin-cloud-layer/` alone when using the local `file:../payin-open/apps/api` dependency;
- copy PayIn Open payment processors, managers, auth internals, or payment route implementations into this layer.

---

## Production readiness status

PayIn Cloud Layer is currently a hosted sandbox/proof layer, not a final production launch package.

Ready for:

- Railway-hosted demos;
- internal product walkthroughs;
- order/deposit business-flow e2e validation;
- Cloud admin/control-plane iteration;
- testing the PayIn Open composition architecture.

Not yet a production approval for:

- real email delivery;
- third-party OAuth launch;
- billing/subscription enforcement;
- mainnet settlement;
- migration of existing production customer data;
- final observability, incident response, and security review.

Before production launch, use:

```sh
npm run production-readiness:check -- --audit
node scripts/check-production-readiness.mjs --json
npm run control-plane:db:migrate  # only where DATABASE_URL is explicitly configured
```

See also:

- [`docs/production-readiness-r10.md`](docs/production-readiness-r10.md)
- [`docs/testnet-config.md`](docs/testnet-config.md)
- [`docs/runbook.md`](docs/runbook.md)
- [`docs/deployment.md`](docs/deployment.md)

---

## Troubleshooting

### Railway deploy fails with `Cannot find module '@payin/app/server'`

You probably deployed from `payin-cloud-layer/` instead of the monorepo root.

Fix:

```sh
cd payincom
railway deployment up --detach --message "Deploy PayIn Cloud Layer from monorepo root"
```

### Hosted e2e passes locally but not on Railway

Check that you are testing the latest deployment:

```sh
railway status
railway deployment list
```

Then rerun:

```sh
cd payin-cloud-layer
BASE_URL=https://<your-service>.up.railway.app npm run hosted:business:e2e
```

### Address pool or proof state looks reused

The hosted proof service keeps process-local state for the running service. The hosted e2e script uses unique order/deposit references and fresh addresses for each run, and it cleans old active deposit bindings when needed.

### Admin UI loads but API calls fail

Make sure the admin build uses the hosted API path:

```sh
VITE_API_URL=/api/v1 VITE_PAYMENT_LINK_PUBLIC_URL=/ npm run build
```

The root Railway build command already does this.

---

## Project status in one sentence

**PayIn Cloud Layer is a Railway-deployable Web3 payment cloud overlay that proves order and deposit business flows on top of PayIn Open without forking the payment core.**
