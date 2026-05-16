# PayIn Cloud Layer Parity Matrix

This matrix tracks old PayIn Cloud capability parity as `payin-cloud-layer` is rebuilt by tests.

Status legend:

- `contracted`: standalone contract + tests exist in `payin-cloud-layer`.
- `adapter-pending`: contract exists; concrete old Cloud/runtime adapter is not implemented yet.
- `planned`: not yet contracted.

| Capability | Old Cloud reference | New Cloud layer files | Tests | Status |
|---|---|---|---|---|
| Tenant context | `organization_id`, `organization_members` | `src/context.ts`, `src/tenant-resolver.ts` | `tests/unit/cloud-boundary.test.ts` | contracted / adapter-pending |
| Organization roles/plans/status | `packages/auth/src/types/organizations.ts` | `src/organization.ts` | `tests/unit/organization-contract.test.ts` | contracted / adapter-pending |
| Organization/member management | `packages/auth/src/organization-manager.ts`, `apps/api/src/routes/organizations.ts` | `src/organization.ts` | `tests/unit/organization-contract.test.ts` | contracted / adapter-pending |
| API key auth/scope | `api_keys`, auth middleware | `src/api-key.ts` | `tests/unit/api-key.test.ts` | contracted / adapter-pending |
| Hosted tenant config | config-management routes | `src/hosted-config.ts` | `tests/unit/hosted-config.test.ts` | contracted / adapter-pending |
| Billing usage metering | hosted billing semantics | `src/usage-meter.ts`, `src/hooks.ts` | `tests/unit/billing-usage.test.ts` | contracted / adapter-pending |
| Audit/risk/support | `packages/auth/src/middleware/audit-middleware.ts` | `src/audit-risk.ts` | `tests/unit/audit-risk-contract.test.ts` | contracted / adapter-pending |
| Orders | `orders`, multi-tenant API tests | `src/orders.ts`, `src/cloud-manager.ts` | `tests/unit/order-contract.test.ts`, `tests/unit/cloud-manager.test.ts` | contracted / adapter-pending |
| Payment links | `apps/api/tests/payment-links-api.test.ts` | `src/payment-links.ts`, `src/cloud-manager.ts` | `tests/unit/payment-link-contract.test.ts` | contracted / adapter-pending |
| Address pool/deposits | `apps/api/tests/address-pool-summary-api.test.ts` | `src/address-pool.ts`, `src/cloud-processor.ts`, `src/cloud-manager.ts` | `tests/unit/address-pool-contract.test.ts`, `tests/unit/cloud-processor.test.ts` | contracted / adapter-pending |
| Webhooks/notifications | `packages/notification/tests/webhook-notifier.test.ts` | `src/webhooks.ts`, `src/cloud-manager.ts` | `tests/unit/webhook-contract.test.ts` | contracted / adapter-pending |
| Processor runtime adapter | shared processor compatibility | `src/cloud-processor.ts` | `tests/unit/cloud-processor.test.ts` | contracted / adapter-pending |
| Hosted runtime readiness/smoke | Cloud ops/readiness | planned | planned | planned |
| Concrete DB/API adapters | old Cloud DB/routes | planned | planned | planned |
| Disposable integration tests | old Cloud E2E behavior | planned | planned | planned |

## Current verification gate

`npm run verify` must pass before every push. As of this matrix update, the suite has 12 test files / 74 tests.

## Next planned slice

Hosted runtime readiness/smoke contract:

- tenant-scoped health/readiness summary
- chain/token/config readiness
- monitor status shape
- actionable failure messages
- no secret leakage in diagnostics
