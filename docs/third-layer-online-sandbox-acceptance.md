# Third Layer Online Sandbox Acceptance

Date: 2026-05-17

## Scope

This acceptance records the new-environment online sandbox deployment for PayIn Cloud Layer. It does **not** modify or replace the old PayIn Cloud repository/runtime.

## Deployed environment

- Platform: Railway
- Project: `payincloudsandbox`
- Project ID: `b6d543cd-3089-4252-bf5f-5b3954790967`
- Service: `cloud-runtime`
- Service ID: `32021937-3194-4372-8fde-d5d9611ef8e5`
- Environment: `production` inside the dedicated sandbox project
- Public URL: `https://cloud-runtime-production-13e5.up.railway.app`
- Successful deployment ID: `d65ee98f-069f-4013-9b48-517ae56ea26d`

## Runtime entrypoint

- `src/standalone-runtime.ts` composes Cloud Layer services into a Hono runtime.
- `src/server.ts` starts the runtime with `@hono/node-server`.
- `/healthz` is unauthenticated for platform health checks.
- `railway.json` configures `npm start` and `/healthz` health checks.

## Online E2E coverage

Command:

```bash
PAYIN_E2E_BASE_URL=https://cloud-runtime-production-13e5.up.railway.app \
PAYIN_E2E_API_KEY=pk_live_cloud_layer_sandbox_admin \
npm run test:e2e:deployed
```

Result:

```json
{
  "ok": true,
  "baseUrl": "https://cloud-runtime-production-13e5.up.railway.app",
  "orderId": "order-1",
  "paymentLinkId": "plink-1",
  "slug": "deployed-e2e-mp9gqgz2",
  "endpointId": "wh-mp9gqgz2"
}
```

Covered flow:

- authenticated readiness
- hosted config
- order creation
- public order status
- payment link creation
- payment link publish
- public checkout data contract
- address pool import
- address pool summary
- webhook endpoint upsert
- webhook test delivery contract
- API key creation
- runtime smoke
- unauthenticated edge failure returns `401`

## CI and integration evidence

- GitHub Verify for deployable runtime: `https://github.com/payincom/payin-cloud-layer/actions/runs/25984820054`
- Disposable PostgreSQL Integration after deployable runtime changes: `https://github.com/payincom/payin-cloud-layer/actions/runs/25984844257`
- Local `npm run verify`: 61 test files passed, 225 passed / 1 skipped.

## Explicit non-goals

This sandbox is not a production cutover and does not claim full parity with every old production Cloud route/UI. The old PayIn Cloud repo remains untouched. The sandbox proves that the new Cloud Layer can be deployed online in an isolated environment and execute the core Cloud runtime flow end-to-end over public HTTP.
