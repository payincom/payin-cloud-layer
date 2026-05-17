# Disposable Integration Tests

`payin-cloud-layer` adapter contracts are unit-tested by default. Real database/runtime integration must be explicitly enabled and must use disposable resources only.

## Safety gate

Integration tests must check both:

```ts
shouldRunDisposableIntegration(process.env)
assertDisposableIntegrationDatabaseUrl(process.env.DATABASE_URL ?? '')
```

Required opt-in:

```bash
PAYIN_CLOUD_LAYER_INTEGRATION=1
```

Allowed database URLs must be PostgreSQL and one of:

- localhost / `127.0.0.1`
- database name contains `test`
- database name contains `disposable`

Do not point integration tests at production, sandbox customer data, or the old Cloud repo runtime without explicit approval.

## Current status

The repository has SQL adapter contracts against `SqlQueryRecorder` and a gated disposable DB integration test at `tests/integration/disposable-db.test.ts`.

Default `npm run verify` does not require a database. It runs the integration file in disabled mode and documents the opt-in gate.

Manual GitHub workflow `Disposable Integration` starts a PostgreSQL 16 service, sets `PAYIN_CLOUD_LAYER_INTEGRATION=1`, applies the minimal schema, and exercises tenant resolver plus organization/member/API-key/subscription/hosted-config/order/payment-link/address-pool/webhook/notification-delivery/usage/audit SQL adapters. It also verifies `SubscriptionBillingLimitEnforcer` against `SqlCloudSubscriptionRepository` + `SqlCloudUsageMeter`, including both an allowed decision and a hard limit denial.

Verified workflow run after subscription persistence expansion: `https://github.com/payincom/payin-cloud-layer/actions/runs/25979345470`.
