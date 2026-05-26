# Cloud layer deployment templates

This directory contains example-only deployment templates for a hosted PayIn Cloud overlay. The templates are derived from the structure of the private Cloud repo's deployment assets, but all environment-specific values are placeholders and no payment core or secrets are copied.

## Template files

| File | Purpose | Status |
| --- | --- | --- |
| `templates/deployment/railway.api.example.toml` | Hosted API service shape: build, start, health check, restart policy, and safe variable notes. | Example-only |
| `templates/deployment/railway.admin.example.toml` | Hosted admin static frontend shape: Dockerfile builder, public build args, health check, restart policy. | Example-only |
| `templates/deployment/Dockerfile.admin.example` | Static admin build/runtime pattern with nginx. | Example-only |
| `docs/cloud-deployment-assets-inventory.md` | Source asset classification and migration decision log. | Inventory |

## Hosted API overlay pattern

The Cloud layer should compose the Open API through a stable package/app seam, then add hosted-only configuration, operations, tenancy, billing, admin, and deployment concerns around it. It must not duplicate payment processors, managers, auth internals, or route logic from Open.

Expected host-managed configuration includes:

- runtime mode and port;
- database connection string;
- session/JWT secrets;
- RPC/provider API keys;
- webhook signing secrets;
- admin bootstrap credentials;
- public URLs for API, admin, and payment-link surfaces.

## Admin static deployment pattern

Admin deployment can use a Dockerfile-based static build with public Vite build arguments. Treat all `VITE_*` values as public once built into browser assets. Server-side secrets must stay in platform variables or a secret manager and must never be passed as frontend build arguments.

## Environment separation

Maintain separate deployment environments for sandbox/test and production. Each environment should have independent databases, provider credentials, webhook endpoints, domains, and admin access. Production deploys require an explicit launch checklist and rollback plan.

## Do not migrate

Do not copy Open payment core packages, payment route implementations, `.env*` files, private keys, provider credentials, database URLs, Railway project IDs, or CLI variable import/setup scripts into this layer. If a deployment requires Open internals, add or request an explicit Open seam instead.

## Operator workflow

1. Copy the relevant example template into a deployment repository or platform config area.
2. Replace placeholders with environment-specific non-secret values.
3. Add secrets through the hosting platform's secret manager.
4. Build the Open API dependency before the Cloud layer when using local file dependencies.
5. Run health checks against `/health` after deployment.
6. Record validation evidence in `.apcp/reports/` for local spikes.

## Local-safe Cloud policy provider

The Cloud Layer policy guard is locally testable without copying PayIn Open payment core or reading deployment secrets. It composes Open through `cloudOnlyRouteGuard` and makes a Cloud-only decision before the request reaches Open route/auth handlers.

Supported provider configuration:

- `PAYIN_CLOUD_POLICY_MODE`: `enforce` (default), `report-only`, or `off`.
- `PAYIN_CLOUD_ALLOWED_TENANTS`: comma-separated tenant allowlist; use `*` only for local diagnostics or explicitly controlled hosted environments.
- `PAYIN_CLOUD_DIAGNOSTIC_AUTH_TOKENS`: comma-separated diagnostic tokens accepted with `Authorization: PayIn-Diagnostic <token>`; keep real values in the hosting secret manager.
- `PAYIN_CLOUD_API_KEYS`: comma-separated API keys accepted as the full auth header value; keep real values in the hosting secret manager.
- `PAYIN_CLOUD_ALLOW_BEARER_AUTH`: bearer policy auth is disabled by default. Set to an explicit true-like value (`true`, `1`, `yes`, or `on`) only when a deployment intentionally accepts bearer credentials at the Cloud policy layer before Open auth runs.
- `PAYIN_CLOUD_ALLOWED_ENTITLEMENTS`: global entitlement allowlist for Cloud-only features.
- `PAYIN_CLOUD_ENTITLEMENTS_BY_TENANT`: tenant mapping in `tenant-id:Feature A|Feature B;other-tenant:*` format.

Diagnostics are returned as headers (`X-PayIn-Cloud-Policy-*`) and `/cloud-layer/status` reports only counts for token/key/mapping configuration, not secret values. Focused local proof is available with `npm run smoke:policy`; it covers missing tenant, missing auth, missing entitlement, valid policy allow to the Open boundary, `report-only`, and `off` modes.

## R10 Railway proof readiness gate

Run `npm run production-readiness:check` before treating this layer as production-ready. The command is deterministic and local-safe: it inspects source-controlled Cloud Layer code/docs/config for env variable names/defaults and known placeholder seams, but does not read `.env*` files or secret values.

Current local/dev gaps intentionally fail enforce mode. Use `npm run production-readiness:check -- --audit` to collect a passing audit artifact with the same blocker list while the Railway proof provider, simulated auth, database, testnet, observability, and runbook work remains human-gated; billing is a non-goal. Bearer policy auth is no longer a blocker when it remains disabled by default. See `docs/production-readiness-r10.md` for the blocker inventory and exit criteria.


## R10 Railway production-capability proof

R10 is not live production approval. It proves this Cloud layer can run on Railway with hosted Postgres control-plane storage, simulated email/session login, easy Sepolia-style testnet configuration, and an operator runbook. Billing/payment integration, real email delivery, third-party OAuth, and existing production data migration are non-goals.

Useful commands:

```sh
npm run production-readiness:check -- --audit
node scripts/check-production-readiness.mjs --json
npm run control-plane:db:migrate  # only where DATABASE_URL is explicitly configured
```

See `docs/production-readiness-r10.md`, `docs/testnet-config.md`, and `docs/runbook.md`.
