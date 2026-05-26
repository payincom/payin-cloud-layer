# R10 Railway production-capability proof readiness

R10 reframes the old production-readiness blocker gate as a Railway production-capability proof gate. This is not live production approval: it proves that the Cloud layer can run with hosted control-plane persistence, deterministic simulated sign-in, testnet configuration, and operator runbooks without migrating existing production data or integrating billing.

## Scope

- Railway proof environment only; not customer-facing live production.
- No existing production data migration.
- No payment or billing integration; billing is a non-goal for R10.
- Simulated email login is acceptable and must not send real email.
- No third-party OAuth provider is required.
- Railway Postgres creation is authorized, but checks and logs must not read or print secret values.
- PayIn Open payment internals remain protected and are not edited by this layer.

## Gate

Run:

```bash
npm run production-readiness:check -- --audit
node scripts/check-production-readiness.mjs --json
```

The gate inspects source-controlled Cloud Layer files only. It skips `.env*`, generated build output, git metadata, and runtime secret values. Enforce mode should pass for the proof environment when hosted Postgres capability, simulated email session handling, testnet docs, safety policy, and ops docs are present.

## Proof exit criteria

- `PAYIN_CLOUD_CONTROL_PLANE_STORAGE=postgres` selects the pg-backed control-plane storage when `DATABASE_URL` is explicitly configured.
- `npm run control-plane:db:migrate` can bootstrap the Railway Postgres schema without printing the connection string.
- `/api/v1/cloud-layer/control-plane/simulated-email-login` creates a persisted proof session and `HttpOnly` cookie while sending no email.
- Browser storage may hold only a non-secret session preview; it is not the only session boundary.
- Testnet defaults are documented with easy Sepolia-style settings and secret values delegated to Railway variables.
- Readiness, smoke validation, rollback, and incident-response steps are source-controlled.

## Non-goals

Billing, real email delivery, third-party OAuth, live production launch approval, migration of existing production data, and PayIn Open payment-core edits are intentionally outside R10.
