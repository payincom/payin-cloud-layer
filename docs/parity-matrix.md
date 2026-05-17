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
| Organization/member management | `packages/auth/src/organization-manager.ts`, `apps/api/src/routes/organizations.ts` | `src/organization.ts`, `src/services/organization-service.ts`, `src/routes/organization-routes.ts` | contract + service + route + SQL + disposable integration tests | contracted / service-covered / route-covered / SQL-verified |
| API key auth/scope | `api_keys`, auth middleware | `src/api-key.ts`, `src/services/api-key-service.ts`, `src/routes/api-key-routes.ts` | `tests/unit/api-key.test.ts`, `tests/unit/cloud-api-key-service.test.ts`, `tests/unit/api-key-route-harness.test.ts`, SQL + disposable integration | contracted / service-covered / route-covered / SQL-verified |
| Hosted tenant config | config-management routes | `src/hosted-config.ts`, `src/services/hosted-config-service.ts`, `src/routes/hosted-config-routes.ts`, `SqlHostedConfigRepository` | contract + service + route + SQL + disposable integration tests | contracted / service-covered / route-covered / SQL-verified |
| Billing usage metering / subscription enforcement | hosted billing semantics | `src/usage-meter.ts`, `src/subscription.ts`, `src/hooks.ts`, `SqlCloudSubscriptionRepository`, `SqlCloudUsageMeter` | billing usage + period aggregation + subscription enforcement + billing limit enforcer + SQL + disposable integration tests | contracted / entitlement-covered / billing-limit-covered / SQL-verified |
| Audit/risk/support | `packages/auth/src/middleware/audit-middleware.ts` | `src/audit-risk.ts` | `tests/unit/audit-risk-contract.test.ts` | contracted / adapter-pending |
| Orders | `orders`, multi-tenant API tests | `src/orders.ts`, `src/cloud-manager.ts`, `src/services/order-service.ts` | `tests/unit/order-contract.test.ts`, `tests/unit/cloud-manager.test.ts`, `tests/unit/cloud-order-service.test.ts` | contracted / service-covered / adapter-pending |
| Payment links | `apps/api/tests/payment-links-api.test.ts` | `src/payment-links.ts`, `src/cloud-manager.ts`, `src/services/payment-link-service.ts` | `tests/unit/payment-link-contract.test.ts`, `tests/unit/cloud-payment-link-service.test.ts` | contracted / service-covered / adapter-pending |
| Address pool/deposits | `apps/api/tests/address-pool-summary-api.test.ts` | `src/address-pool.ts`, `src/cloud-processor.ts`, `src/cloud-manager.ts`, `src/services/address-pool-service.ts` | `tests/unit/address-pool-contract.test.ts`, `tests/unit/cloud-processor.test.ts`, `tests/unit/cloud-address-pool-service.test.ts` | contracted / service-covered / adapter-pending |
| Webhooks/notifications | `packages/notification/tests/webhook-notifier.test.ts` | `src/webhooks.ts`, `src/notification-delivery.ts`, `src/webhook-delivery-worker.ts`, `src/cloud-manager.ts`, `src/services/webhook-service.ts`, `SqlCloudNotificationDeliveryRepository` | webhook + delivery worker + persistence + SQL + disposable integration tests | contracted / service-covered / worker-covered / delivery-persistence-covered / SQL-verified |
| Processor runtime adapter | shared processor compatibility | `src/cloud-processor.ts` | `tests/unit/cloud-processor.test.ts` | contracted / adapter-pending |
| Hosted runtime readiness/smoke | Cloud ops/readiness | planned | planned | planned |
| Concrete DB/API adapters | old Cloud DB/routes | `src/adapters/repositories/*`, `src/routes/*` | repository + SQL + route harness tests | partially contracted / implementation-pending |
| Disposable integration tests | old Cloud E2E behavior | `tests/integration/disposable-db.test.ts`, `.github/workflows/disposable-integration.yml` | manual GitHub workflow with PostgreSQL service | partially verified / expand coverage |

## Current verification gate

`npm run verify` must pass before every push. Latest default verification after broader legacy compatibility and billing-limit enforcement expansion: 56 test files / 196 passed / 1 skipped. Manual `Disposable Integration` workflow has verified PostgreSQL service execution for tenant/organization/member/API-key/subscription/hosted-config/order/payment-link/address-pool/webhook/notification-delivery/usage/audit adapters.

## Reference inventory snapshot

Read-only old Cloud inventory discovered for future adapter extraction:

- API routes: `apps/api/src/routes/address-pool.ts`, `apps/api/src/routes/api-chains.ts`, `apps/api/src/routes/api-deposits.ts`, `apps/api/src/routes/api-keys.ts`, `apps/api/src/routes/api-payment-links.ts`, `apps/api/src/routes/audit.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/routes/chains.ts`, `apps/api/src/routes/config-diagnostics.ts`, `apps/api/src/routes/config-management.ts`, `apps/api/src/routes/config.ts`, `apps/api/src/routes/deposits.ts`, `apps/api/src/routes/notifications.ts`, `apps/api/src/routes/order-status.ts`, `apps/api/src/routes/orders.ts`, `apps/api/src/routes/organizations.ts`, `apps/api/src/routes/pay-deposit.ts`, `apps/api/src/routes/pay-order.ts`, `apps/api/src/routes/payment-links.ts`, `apps/api/src/routes/tokens.ts`.
- Auth package: `packages/auth/src/auth-manager.ts`, `packages/auth/src/middleware/audit-middleware.ts`, `packages/auth/src/middleware/auth-middleware.ts`, `packages/auth/src/middleware/permission-middleware.ts`, `packages/auth/src/organization-manager.ts`, `packages/auth/src/permissions.ts`, `packages/auth/src/types/organizations.ts`, `packages/auth/src/validation.ts`.
- Manager/config: `packages/manager/src/config-provider-adapter.ts`, `packages/manager/src/config/config-metadata.ts`, `packages/manager/src/config/config-transformer.ts`, `packages/manager/src/services/payment-link.service.ts`, `packages/manager/src/validators/*`.
- Notification/webhook: `packages/notification/src/notification-service.ts`, `packages/notification/src/notifiers/webhook-notifier.ts`, `packages/notification/src/queue/notification-queue.ts`, `packages/notification/src/repository/notification.repository.ts`, `packages/notification/src/types/*`, `packages/notification/src/utils/event-mapper.ts`, `packages/notification/src/utils/retry-strategy.ts`, `packages/notification/src/utils/signature.ts`.
- Processor/payment: `packages/processor/src/repositories/address-pool.repository.ts`, `packages/processor/src/repositories/order.repository.ts`, `packages/processor/src/services/address-import-validator.ts`, `packages/processor/src/services/deposit-service.ts`, `packages/processor/src/services/order-service.ts`, `packages/processor/src/core/order-state-machine.ts`, `packages/processor/src/core/processor-config-manager.ts`.
- Public checkout/shared UI reference: `packages/shared/src/checkout/OrderPage.tsx`, `packages/shared/src/checkout/renderOrder.tsx`, `packages/shared/src/payment-link-checkout-template.ts`.

## Next planned slice

Cloud API route extraction:

- compare old route request/response shapes against the framework-neutral route harnesses
- add framework adapter examples for Hono/Express/Fastify if needed
- wire `SubscriptionBillingLimitEnforcer` into service layer for order/payment-link/API-key/webhook/address-pool write paths
- add route-level compatibility adapter tests for old Cloud envelopes where needed
- add disposable integration coverage for SQL-backed billing limit enforcement
