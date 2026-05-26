# Railway proof runbook

## Pre-deploy

1. Create a Railway Postgres database for the proof environment.
2. Set `PAYIN_CLOUD_CONTROL_PLANE_STORAGE=postgres` and non-secret proof variables in Railway.
3. Set `DATABASE_URL` only through Railway's managed database integration.
4. Run `npm run control-plane:db:migrate` from a context that has `DATABASE_URL`; do not print secret values.
5. Run `npm run production-readiness:check -- --audit` and store the output as APCP evidence.

## Readiness checks

- `GET /health` returns the Open app health response.
- `GET /cloud-layer/status` returns Cloud runtime and policy status without env values.
- `GET /api/v1/cloud-layer/control-plane/status` reports `storage: "postgres"` when Railway DB storage is enabled.
- `POST /api/v1/cloud-layer/control-plane/simulated-email-login` returns `delivery: "simulated-no-email-sent"` and sets `payin_cloud_session` as an `HttpOnly` cookie.
- `npm run smoke:runtime` passes locally without a live DB.


## R11 Admin proof smoke

- `POST /api/v1/auth/login` accepts the proof demo credentials and returns an Admin-compatible token plus `HttpOnly` session cookie.
- Default demo credentials are `admin@example.com` / `payin-demo-password`; Railway may override them with `PAYIN_CLOUD_DEMO_EMAIL` and `PAYIN_CLOUD_DEMO_PASSWORD`.
- `npm run smoke:r11` validates login, address-pool setup, deposit bind/list/stats, and simulated order/deposit webhook proof without printing cookies or bearer tokens.
- Do not deploy from local automation; controller deploys to Railway after review.

## Operations

- Treat this as a proof environment, not live production.
- Monitor Railway deploy status, health checks, process restarts, Postgres connectivity, and 5xx responses.
- Alert owner: PayIn Cloud operator for the active proof run.
- Keep logs free of `DATABASE_URL`, API keys, RPC URLs, cookies, tokens, and private keys.

## Rollback

1. Roll back to the previous Railway deployment.
2. If DB schema bootstrap caused trouble, leave the database intact and switch `PAYIN_CLOUD_CONTROL_PLANE_STORAGE` away from `postgres` only for local diagnostics.
3. Re-run readiness and smoke checks before resuming the proof.
4. Record rollback evidence in `.apcp/logs/` and update `.apcp/state.md`.

## Incident response

- Severity is proof-only unless the environment is accidentally exposed to customers.
- Disable public access or roll back first if session, cookie, or DB behavior is suspect.
- Rotate any Railway variable that may have been printed or pasted outside Railway.
- Do not inspect `.env*` files or secret values during local triage.
