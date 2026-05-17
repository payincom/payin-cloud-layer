# PayIn Open / Cloud Layer Decomposition Plan

Date: 2026-05-17

## Goal

Split the original production `payin-cloud` repository into two independent products/repositories:

- `payin-open`: the complete free/self-hostable base product.
- `payin-cloud-layer`: a Cloud overlay that composes Open and adds SaaS/hosted-only capabilities.

This is a decomposition and decoupling project, not a greenfield rewrite. The old production repository remains read-only and is the primary copy/adaptation source.

## Working principles

1. Reuse first: copy/adapt/refactor existing working code from the old production `payin-cloud` repository whenever feasible.
2. Do not reimplement Open core behavior in the Cloud layer.
3. If Open is not decoupled enough for Cloud to compose it, change Open to expose the needed package, port, or extension seam.
4. Keep Cloud-only behavior low-coupled and outside Open core.
5. Validate each migrated slice with local tests and deployed sandbox/manual-test E2E before treating it as usable.

## Current source repositories

| Path | Role | Mutation policy |
| --- | --- | --- |
| `/data/openclaw/workspace/payin` | old production `payin-cloud`, canonical working-code source | read-only unless explicitly authorized |
| `/data/openclaw/workspace/payin-open` | Open base product | modify to expose reusable core/seams |
| `/data/openclaw/workspace/payin-cloud-layer` | Cloud overlay/layer | modify to compose Open and host Cloud-only code |

## Module ownership target

| Old production module | Target owner | Migration mode |
| --- | --- | --- |
| `packages/shared/src/checkout` | Open shared checkout, consumed by Cloud | copy/adapt from old, keep UI/runtime reusable |
| `packages/monitor` | Open core | copy/adapt; Cloud configures hosted RPC/provider policy |
| `packages/processor` | Open core | copy/adapt; Cloud wraps tenant/scaling/ops behavior |
| `packages/manager` | Open core config/business manager with extension seams | copy/adapt; move hosted/multi-tenant knobs behind ports/defaults |
| `apps/api/src/routes/orders.ts` | Open API core route; Cloud wraps auth/tenant | copy/adapt, avoid duplicate order implementation in layer |
| `apps/api/src/routes/payment-links.ts` | Open API core + public checkout | copy/adapt, add Cloud policy externally |
| `apps/api/src/routes/checkout*.ts`, `pay-order.ts`, `pay-deposit.ts` | Open/public runtime | copy/adapt, Cloud only configures hosted URLs/domains |
| `apps/api/src/routes/transfers.ts`, `transfer-status.ts`, `deposits.ts` | Open monitor/payment core | copy/adapt; Cloud adds hosted observability/SLA |
| `packages/auth`, `apps/api/src/routes/auth.ts`, `organizations.ts`, `users.ts` | Shared auth package with Cloud-heavy surfaces | keep reusable primitives; Cloud owns SaaS org/member UX/policy |
| `apps/api/src/routes/api-keys.ts` | Cloud and Open operator API with policy differences | copy/adapt; Open default unrestricted/self-hosted, Cloud enforces tenant/billing |
| `apps/api/src/routes/audit.ts`, `notifications.ts` | Cloud overlay primarily; Open optional/self-hosted defaults | copy/adapt into layer where hosted behavior is required |
| `apps/admin` | Cloud admin UI, possible Open admin subset later | copy old UI into layer and adapt API/auth only as needed |
| Railway/Docker deployment files | split by product | Cloud layer owns hosted deployment; Open owns self-host docs/deployment |

## First migrated slice in this repository

The old Admin UI has been copied from:

- `/data/openclaw/workspace/payin/apps/admin`
- minimal shared checkout support from `/data/openclaw/workspace/payin/packages/shared`

into:

- `apps/admin`
- `packages/shared`

The copied Admin UI preserves old code structure and adds only manual-test API-key login compatibility in `apps/admin/src/contexts/AuthContext.tsx` so the current Cloud layer sandbox can be tested before full auth migration is completed.

## Reused old-production notification/webhook behavior

The Cloud layer webhook signature path now reuses the old production notification package behavior from:

- `/data/openclaw/workspace/payin/packages/notification/src/utils/signature.ts`

Adapted into:

- `src/webhooks.ts`

The overlay keeps its Cloud-specific secret-reference boundary (`secret://...`) but signs deliveries with the legacy PayIn HMAC format `t=<unix-seconds>,v1=<sha256>` and supports `secret://env/<NAME>` resolution for hosted deployments. This replaces the earlier static-signature-only sandbox path for production mode while preserving static signatures for tests/manual sandbox compatibility.

## What to do next

1. Replace the newly-written Cloud layer order/payment-link/checkout core with composition of `payin-open` Open runtime APIs or extracted Open packages.
2. Move any missing reusable seams into `payin-open` rather than duplicating them here.
3. Keep Cloud layer implementations only for tenant/auth/billing/audit/webhook-delivery/hosted-ops overlays.
4. Convert the current `scripts/deployed-e2e.mjs` into an overlay acceptance suite that runs against Open-composed Cloud runtime.
5. Remove or quarantine spike code after a copied/adapted old-production implementation replaces it.
