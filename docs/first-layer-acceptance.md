# First-layer Cloud Overlay acceptance

This document defines the first-layer completion target for `payin-cloud-layer`.

The first layer is complete when this repository is a tested, independent Cloud Overlay base over PayIn Open/shared payment concepts. It does **not** require replacing the old PayIn Cloud runtime yet; that is the second layer. The first layer must provide framework-neutral contracts and route/service/repository seams that a concrete Cloud runtime can bind to.

## Acceptance checklist

- [x] Tenant/organization context is explicit and isolated from PayIn Open core.
- [x] API-key authentication/scope contracts exist with management service/routes and SQL persistence.
- [x] Organization/member management service/routes and SQL persistence are covered.
- [x] Hosted config service/routes and SQL persistence are covered.
- [x] Billing usage, subscription entitlement, billing-limit enforcement, and write-path enforcement are covered.
- [x] Orders have contract, service, create/get/list route harnesses, SQL adapter coverage, and legacy envelope compatibility.
- [x] Payment links have contract, service, create/get/list/publish route harnesses, SQL adapter coverage, and legacy envelope compatibility.
- [x] Address pool has contract, import/list/summary service-route coverage, SQL adapter coverage, and billing-limit enforcement.
- [x] Webhooks/notifications have endpoint service/routes, delivery persistence, worker/retry contracts, and SQL adapter coverage.
- [x] Public checkout/status contracts exist for order status and payment-link checkout data without binding to old SSR runtime.
- [x] Config diagnostics contract preserves old diagnostics shape and redacts configured secrets.
- [x] Hosted runtime readiness/smoke contracts and route harnesses exist.
- [x] Legacy `/api/v1` route envelope adapter preserves old response shapes for migration.
- [x] Disposable PostgreSQL integration verifies the critical SQL adapters and SQL-backed billing-limit decisions.
- [x] Repository boundary tests prevent direct old Cloud/Open runtime imports or `file:` coupling.
- [x] `npm run verify` is the default green gate.

## Explicitly second-layer work

These are intentionally outside first-layer completion and belong to the concrete migration/replacement phase:

- Bind route harnesses to a concrete Hono/Fastify/Express runtime.
- Replace old PayIn Cloud modules in `/data/openclaw/workspace/payin`.
- Run full old Cloud HTTP E2E flows against a deployed runtime.
- Migrate public SSR rendering bundles and templates.
- Complete operational deployment/rollout automation for PayIn Cloud production.

## Current evidence

- Local default verification: `npm run verify`.
- Real PostgreSQL path: `.github/workflows/disposable-integration.yml` plus `tests/integration/disposable-db.test.ts`.
- Capability status: `docs/parity-matrix.md`.
