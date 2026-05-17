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
| Config diagnostics | `apps/api/src/routes/config-diagnostics.ts` | `src/config-diagnostics.ts` | `tests/unit/config-diagnostics-contract.test.ts` | contracted / route-adapter-pending |
| Billing usage metering / subscription enforcement | hosted billing semantics | `src/usage-meter.ts`, `src/subscription.ts`, `src/hooks.ts`, `SqlCloudSubscriptionRepository`, `SqlCloudUsageMeter`, service-layer `billingLimitEnforcer` wiring | billing usage + period aggregation + subscription enforcement + billing limit enforcer + write-path service enforcement + SQL + disposable integration tests | contracted / entitlement-covered / billing-limit-covered / write-path-covered / SQL-verified |
| Audit/risk/support | `packages/auth/src/middleware/audit-middleware.ts` | `src/audit-risk.ts` | `tests/unit/audit-risk-contract.test.ts` | contracted / adapter-pending |
| Orders | `orders`, multi-tenant API tests | `src/orders.ts`, `src/cloud-manager.ts`, `src/services/order-service.ts`, `src/routes/order-routes.ts` | `tests/unit/order-contract.test.ts`, `tests/unit/cloud-manager.test.ts`, `tests/unit/cloud-order-service.test.ts`, `tests/unit/order-route-harness.test.ts` | contracted / service-covered / create-get-list-route-covered / adapter-pending |
| Payment links | `apps/api/tests/payment-links-api.test.ts` | `src/payment-links.ts`, `src/cloud-manager.ts`, `src/services/payment-link-service.ts`, `src/routes/payment-link-routes.ts` | `tests/unit/payment-link-contract.test.ts`, `tests/unit/cloud-payment-link-service.test.ts`, `tests/unit/payment-link-route-harness.test.ts` | contracted / service-covered / create-get-list-publish-route-covered / adapter-pending |
| Address pool/deposits | `apps/api/tests/address-pool-summary-api.test.ts` | `src/address-pool.ts`, `src/cloud-processor.ts`, `src/cloud-manager.ts`, `src/services/address-pool-service.ts`, `src/routes/address-pool-routes.ts` | `tests/unit/address-pool-contract.test.ts`, `tests/unit/cloud-processor.test.ts`, `tests/unit/cloud-address-pool-service.test.ts`, `tests/unit/address-pool-route-harness.test.ts` | contracted / import-list-summary-route-covered / adapter-pending |
| Webhooks/notifications | `packages/notification/tests/webhook-notifier.test.ts` | `src/webhooks.ts`, `src/notification-delivery.ts`, `src/webhook-delivery-worker.ts`, `src/cloud-manager.ts`, `src/services/webhook-service.ts`, `SqlCloudNotificationDeliveryRepository` | webhook + delivery worker + persistence + SQL + disposable integration tests | contracted / service-covered / worker-covered / delivery-persistence-covered / SQL-verified |
| Public order/payment-link checkout | `apps/api/src/routes/pay-order.ts`, `apps/api/src/routes/order-status.ts`, `apps/api/src/routes/checkout.ts` | `src/public-checkout.ts` | `tests/unit/public-checkout-contract.test.ts` | contracted / framework-adapter-pending |
| Processor runtime adapter | shared processor compatibility | `src/cloud-processor.ts` | `tests/unit/cloud-processor.test.ts` | contracted / adapter-pending |
| Hosted runtime readiness/smoke | Cloud ops/readiness | `src/runtime-readiness.ts`, `src/routes/runtime-readiness-routes.ts` | `tests/unit/runtime-readiness.test.ts`, `tests/unit/runtime-readiness-route-harness.test.ts` | contracted / route-covered / framework-adapter-pending |
| Concrete DB/API adapters | old Cloud DB/routes | `src/adapters/repositories/*`, `src/routes/*`, `toLegacyCloudRouteResponse` | repository + SQL + route harness + legacy route envelope adapter tests | partially contracted / route-envelope-covered / implementation-pending |
| Disposable integration tests | old Cloud E2E behavior | `tests/integration/disposable-db.test.ts`, `.github/workflows/disposable-integration.yml` | manual GitHub workflow with PostgreSQL service | partially verified / expand coverage |

## Current verification gate

`npm run verify` must pass before every push. Latest default verification after public checkout and route/readiness expansion: 58 test files / 215 passed / 1 skipped before the final readiness/address-pool-list additions. Manual `Disposable Integration` workflow has verified PostgreSQL service execution for tenant/organization/member/API-key/subscription/hosted-config/order/payment-link/address-pool/webhook/notification-delivery/usage/audit adapters and SQL-backed subscription billing-limit decisions. Route-level legacy envelope coverage now adapts new route harness `{data}` responses back to old Cloud envelopes such as `{apiKey, metadata}`, `{config}`, and `{endpoint}` without changing error bodies.

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
- expand concrete framework adapter examples for Cloud route harnesses if needed
- continue old Cloud route extraction for auth/public checkout surfaces
- bind the framework-neutral first-layer route harnesses to a concrete runtime in the second-layer migration phase
- replace old Cloud modules incrementally with the new route/service/repository contracts
