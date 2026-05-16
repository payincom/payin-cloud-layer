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

The repository currently has SQL adapter contracts against `SqlQueryRecorder`. Disposable DB tests are intentionally not yet wired. The next phase is to add schema fixtures and run the existing SQL adapters against an empty disposable Postgres database.
