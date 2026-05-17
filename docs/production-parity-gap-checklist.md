# Production Parity Gap Checklist

Date: 2026-05-17

This checklist tracks remaining work to move from the isolated Cloud Layer online sandbox to full old-production parity. The old PayIn Cloud repository remains read-only.

## Completed in the new sandbox

- Standalone Hono runtime deploys to Railway without the old PayIn Cloud repo.
- Core merchant API flow works online over public HTTP.
- Public checkout now supports both JSON contracts and minimal HTML shells:
  - `GET /checkout/:slug` with `Accept: text/html`
  - `GET /pay/order/:orderId`
- Public payment-link checkout API now supports:
  - `GET /api/payment-links/:slug`
  - `POST /api/payment-links/:slug/orders`
- Online E2E validates checkout JSON, checkout HTML, order status HTML, public checkout order creation, merchant APIs, webhook tests, smoke, and auth failure.

## Remaining gaps before full production replacement

### P0 — Public payment page parity

- [x] Minimal HTML checkout shell for `/checkout/:slug`.
- [x] Minimal HTML order status shell for `/pay/order/:orderId`.
- [x] Public payment-link detail API.
- [x] Public payment-link order creation API.
- [ ] Full old checkout SSR/React bundle parity, including exact UI assets, QR rendering, wallet UX, timers, disabled/draft/sold-out states, and redirect UX.
- [ ] `GET /pay/deposit/:address` deposit payment page.
- [ ] `GET /checkout/preview/:id?token=...&viewport=...` preview flow.
- [ ] Legacy field aliases such as `redirect_url` in addition to `redirectUrl` where old clients depend on snake_case.

### P0 — Deposits/transfers/chains/tokens

- [ ] Chain and token discovery routes.
- [ ] Deposit reference APIs.
- [ ] Transfer detection/status APIs.
- [ ] Address-bound deposit page and status polling.
- [ ] Real chain monitor integration rather than in-memory status only.

### P1 — Management API surface

- [ ] User/auth routes beyond API-key auth.
- [ ] Audit/event list routes.
- [ ] Full config-management CRUD parity.
- [ ] Webhook endpoint list/delete and delivery listing/replay routes.
- [ ] Organization/member routes exposed through the deployable Hono runtime, not only route harnesses.

### P1 — Persistence and operations

- [ ] Deploy sandbox against managed PostgreSQL adapters instead of the current in-memory standalone runtime.
- [ ] Apply migrations automatically or through a safe deployment step.
- [ ] Configure production-grade secrets, CORS, domains, observability, rate limits, and rollback.
- [ ] Run deployed E2E against managed PostgreSQL and confirm state survives redeploy.

### P2 — Compatibility hardening

- [ ] Snapshot old HTTP response envelopes for the remaining routes.
- [ ] Add contract tests for old error codes/statuses.
- [ ] Add browser-level checkout tests for the HTML flows.
- [ ] Add load/smoke tests for Railway sandbox readiness.

## Current online evidence

- Railway sandbox: `payincloudsandbox` / `cloud-runtime`
- URL: `https://cloud-runtime-production-13e5.up.railway.app`
- Latest public checkout/order API E2E passed with slug `deployed-e2e-mp9hlkzl`.
- Latest commit implementing public payment-link order API: `f9e4cfc`.
