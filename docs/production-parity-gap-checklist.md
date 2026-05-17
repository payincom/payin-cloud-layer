# Production Parity Gap Checklist

Date: 2026-05-17

This checklist tracks remaining work to move from the isolated Cloud Layer online sandbox to full old-production parity. The old PayIn Cloud repository remains read-only.

## Completed in the new sandbox

- Standalone Hono runtime deploys to Railway without the old PayIn Cloud repo.
- Railway sandbox now runs against a managed Railway PostgreSQL service (`Postgres`) through `DATABASE_URL`; schema is applied on startup and core state survives service restart.
- Core merchant API flow works online over public HTTP.
- Public checkout now supports both JSON contracts and minimal HTML shells:
  - `GET /checkout/:slug` with `Accept: text/html`
  - `GET /pay/order/:orderId`
- Public payment-link checkout API now supports:
  - `GET /api/payment-links/:slug`
  - `POST /api/payment-links/:slug/orders`
- Public deposit and preview page shells now support:
  - `GET /pay/deposit/:address`
  - `GET /checkout/preview/:id?token=...&viewport=...`
- Public discovery/status APIs now support:
  - `GET /api/chains`
  - `GET /api/tokens`
  - `GET /api/v1/chains`
  - `GET /api/v1/tokens`
  - `GET /api/deposits/:address/status`
  - `GET /api/orders/:orderId/transfers`
  - `GET /api/transfers/:transactionHash/status`
- Online E2E validates chain/token discovery, checkout JSON, checkout HTML, checkout preview HTML, order transfer/status APIs, order status HTML, deposit HTML/status API, public checkout order creation, merchant APIs, webhook endpoint list/delete/test, webhook delivery list/replay, audit event list, smoke, and auth failure.

## Remaining gaps before full production replacement

### P0 — Public payment page parity

- [x] Minimal HTML checkout shell for `/checkout/:slug`.
- [x] Minimal HTML order status shell for `/pay/order/:orderId`.
- [x] Public payment-link detail API.
- [x] Public payment-link order creation API.
- [ ] Full old checkout SSR/React bundle parity, including exact UI assets, QR rendering, wallet UX, timers, disabled/draft/sold-out states, and redirect UX.
- [x] Minimal `GET /pay/deposit/:address` deposit payment page shell.
- [x] Minimal `GET /checkout/preview/:id?token=...&viewport=...` preview flow.
- [ ] Legacy field aliases such as `redirect_url` in addition to `redirectUrl` where old clients depend on snake_case.

### P0 — Deposits/transfers/chains/tokens

- [x] Minimal chain and token discovery routes.
- [x] Minimal deposit status/reference API for address-bound deposits.
- [x] Minimal transfer detection/status APIs.
- [x] Minimal address-bound deposit page shell.
- [x] Minimal deposit status polling JSON API.
- [ ] Real chain monitor integration rather than in-memory status only.

### P1 — Management API surface

- [ ] User/auth routes beyond API-key auth.
- [ ] Audit/event list routes.
- [ ] Full config-management CRUD parity.
- [x] Webhook endpoint list/delete routes.
- [x] Webhook delivery listing/replay routes.
- [x] Audit event listing route.
- [ ] Organization/member routes exposed through the deployable Hono runtime, not only route harnesses.

### P1 — Persistence and operations

- [x] Deploy sandbox against managed PostgreSQL adapters instead of the current in-memory standalone runtime.
- [x] Apply minimal schema automatically on startup for the sandbox.
- [ ] Configure production-grade secrets, CORS, domains, observability, rate limits, and rollback.
- [x] Run deployed E2E against managed PostgreSQL and confirm state survives restart.

### P2 — Compatibility hardening

- [ ] Snapshot old HTTP response envelopes for the remaining routes.
- [ ] Add contract tests for old error codes/statuses.
- [ ] Add browser-level checkout tests for the HTML flows.
- [ ] Add load/smoke tests for Railway sandbox readiness.

## Current online evidence

- Railway sandbox: `payincloudsandbox` / `cloud-runtime`
- URL: `https://cloud-runtime-production-13e5.up.railway.app`
- Latest managed-PostgreSQL public discovery/checkout/order/deposit/preview/transfer/webhook-delivery/audit E2E passed with slug `deployed-e2e-mp9m07dv`.
- Latest persisted state verified after Railway restart: order `order-mp9l9sq5-yrndogpu` and payment-link slug `deployed-e2e-mp9l9rom` remained readable.
- Latest commit implementing webhook delivery list/replay APIs: `a00f63b`.
