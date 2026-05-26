# payin-cloud-layer spike

Local spike requested by JQ to test whether PayIn Cloud can become an overlay on top of `payin-open` instead of a fork/copy of payment core.

## What this contains

- Minimal TypeScript package skeleton.
- npm workspace packaging for Cloud-owned apps under `apps/*`.
- `apps/admin`: Cloud-owned admin UI source adapted from the private Cloud admin app, with frontend-only source/config/public assets.
- `src/adapters/open-app.ts`: imports `createApp(options)` through the stable local package seam `@payin/app/server`.
- Cloud guard override that enables Open-guarded hosted routes for spike purposes.
- Layer-only status routes at `/cloud-layer/status`, `/api/v1/cloud-layer/status`, `/cloud-layer/admin/status`, and `/api/v1/cloud-layer/admin/status`.
- Cloud-owned local SaaS control-plane routes under `/api/v1/cloud-layer/control-plane/*` for deterministic development and smoke tests.
- Docs inventory and feasibility report under `docs/`.

## What this intentionally avoids

- No copied `packages/processor`, `packages/manager`, `packages/auth`, or payment route logic.
- No copied `apps/api` backend route implementations.
- No secrets or environment-specific credentials.
- No migrated `.env*` files. Vite admin variables are public browser config only.
- No pushes.

## Cloud control-plane provider contracts

M7 hardens the Cloud-owned control-plane boundary around explicit TypeScript contracts in `src/cloud-control-plane-contracts.ts`. Routes and the Admin UI depend on the `CloudControlPlaneProvider` surface for auth/session summaries, organizations/tenants, API-key metadata, and entitlement evaluation; they do not depend on a particular storage implementation.

Current implementations and seams:

- `LocalControlPlaneProvider` is the active local-development implementation.
- `InMemoryLocalControlPlaneStorage` remains the default and is selected unless an explicit local durable mode is configured.
- `LocalJsonFileControlPlaneStorage` is still available only when `PAYIN_CLOUD_LOCAL_CONTROL_PLANE_DURABLE=true` and `PAYIN_CLOUD_LOCAL_CONTROL_PLANE_FILE=/path/to/local-control-plane.json` are both set.
- `DisabledPostgresControlPlaneStorage` in `src/postgres-control-plane-storage.ts` is a compile-time Postgres/hosted-DB adapter seam only. It is disabled by default, throws on accidental selection, creates no external resources, reads no secrets, and is not production-ready.

Provider selection is explicit and gated. Run `npm run control-plane:db:migrate` only in an environment where `DATABASE_URL` is explicitly configured. The migration/check commands do not print the connection string. The status endpoint reports storage kind and provider descriptor so smoke tests can detect boundary drift.

## Local SaaS control plane

M6/M7 evolve the M4 Cloud-owned provider into a storage-backed local development control plane behind the M7 provider contracts. It is mounted with Open's `extendApiRoutes` seam under `/api/v1/cloud-layer/control-plane/*` and does not override Open payment or organization routes.

Available local-dev endpoints:

- `GET /api/v1/cloud-layer/control-plane/status` reports provider mode, storage kind, deterministic behavior, and counts.
- `POST /api/v1/cloud-layer/control-plane/bootstrap` creates/returns the deterministic local organization, user, session summary, and entitlements.
- `POST /api/v1/cloud-layer/control-plane/dev-login` returns a session-like local development summary for admin smoke tests; it is not production authentication.
- `GET /api/v1/cloud-layer/control-plane/org/current` resolves the current local tenant/org, preferring `X-Organization-Id` when provided.
- `GET /api/v1/cloud-layer/control-plane/api-keys` lists local API key metadata.
- `POST /api/v1/cloud-layer/control-plane/api-keys` creates local API key metadata and returns only a non-secret preview/checksum, never secret material.
- `GET /api/v1/cloud-layer/control-plane/entitlements/status` evaluates deterministic local entitlements and quotas.

By default the provider uses process-local memory. A file-backed JSON store is available only for local development when both `PAYIN_CLOUD_LOCAL_CONTROL_PLANE_DURABLE=true` and `PAYIN_CLOUD_LOCAL_CONTROL_PLANE_FILE=/path/to/local-control-plane.json` are set, or when tests pass an explicit storage instance. This durable local mode is not a production security boundary: it is a dev-only architecture seam for future hosted DB-backed storage. Sessions remain development summaries, and API keys are persisted only as non-secret preview/checksum metadata; no secret API key values are written.

The migrated Admin UI includes a Cloud-owned local shell at `/admin/cloud-layer/control-plane`. Use the local-dev button on `/admin/login` to call `POST /api/v1/cloud-layer/control-plane/dev-login`; it stores a `local-dev-control-plane:*` browser token for this non-production shell only. The panel displays control-plane status, current org, entitlements, and API key previews/checksums without showing secrets. Railway proof deployments can use the hosted Postgres storage; browser tokens remain non-secret previews and the simulated email flow sets a server-side session cookie.

## Auth compatibility routes

The Cloud layer owns a small admin-login compatibility extension mounted through `createCloudApiApp` and Open's `extendApiRoutes` seam:

- `POST /api/v1/auth/magic-link` validates JSON `email` and optional `redirectTo`, never sends real email, and returns `authenticated: false` with `delivery: "disabled"` by default.
- Set `PAYIN_CLOUD_AUTH_COMPAT_MODE=local-dev` only to label the stub response as local development; it still does not create a session or send email.
- Real magic-link delivery remains future work for a hosted Cloud auth provider.
- `GET /api/v1/auth/oauth/config` remains the existing Open route; Cloud policy allows this public config endpoint through in enforce mode so the admin login screen can discover provider availability without exposing secret values.

## Admin runtime serving

`createCloudApiApp()` mounts the Cloud-owned static admin bundle from `apps/admin/dist` at `/admin`. Static assets are served under `/admin/assets/*`, and nested admin routes such as `/admin/cloud-layer/control-plane` fall back to `apps/admin/dist/index.html` for SPA routing. The admin status endpoints report only whether `dist/index.html` and `dist/assets/` exist plus the names of public Vite configuration variables; they do not return environment values.

## Admin UI public config

Open the local Cloud admin shell after building and starting the API:

1. Run `npm run build:admin && npm run build && npm start`.
2. Visit `http://localhost:3000/admin`.
3. Choose `Enter Local Cloud Layer Shell` on `/admin/login`.
4. Inspect `http://localhost:3000/admin/cloud-layer/control-plane` for local control-plane status, current org, entitlement quota usage, and safe API key previews.

The admin app lives in `apps/admin` and defaults to the local Cloud API:

- `VITE_API_URL` defaults to `http://localhost:3000/api/v1`.
- `VITE_PAYMENT_LINK_PUBLIC_URL` is optional and controls public payment-link preview URLs.

Both variables are compiled into browser assets by Vite. Treat them as public routing/config values only; never put secrets, tokens, private keys, or credentials in `VITE_*` variables.

## Local validation

```sh
cd /data/openclaw/workspace/payincom/payin-cloud-layer
npm install
npm run validate
```

`npm run validate` is the repeatable bounded-slice check for this spike. It runs:

1. `npm run build:open-api` — builds the local Open API dependency with `npm --prefix ../payin-open run build -w apps/api` before the layer consumes `@payin/app/server`.
2. `npm run type-check` — verifies the Cloud layer TypeScript without emit.
3. `npm run build` — compiles the Cloud layer into `dist/`.
4. `npm run build:admin` — builds the Cloud-owned admin workspace when dependencies are installed.
5. `npm run safety:scan` — checks for forbidden core/backend copies, likely secret literals/credential markers, and docs/template path consistency across the layer and admin app.

The layer depends on the local Open API package via `@payin/app`: `file:../payin-open/apps/api`. Open must be built first so `@payin/app/server` resolves to `dist/server.js` and `dist/server.d.ts`.


## R10 Railway production-capability proof

R10 is not live production approval. It proves this Cloud layer can run on Railway with hosted Postgres control-plane storage, simulated email/session login, easy Sepolia-style testnet configuration, and an operator runbook. Billing/payment integration, real email delivery, third-party OAuth, and existing production data migration are non-goals.

Useful commands:

```sh
npm run production-readiness:check -- --audit
node scripts/check-production-readiness.mjs --json
npm run control-plane:db:migrate  # only where DATABASE_URL is explicitly configured
```

See `docs/production-readiness-r10.md`, `docs/testnet-config.md`, and `docs/runbook.md`.
