# Second-layer Cloud runtime acceptance

The second layer binds the first-layer Cloud Overlay contracts to a concrete HTTP runtime and proves old Cloud `/api/v1` paths can execute through the new service/repository layer.

## Completed scope

- [x] Hono adapter exports `createCloudHonoApp`.
- [x] Hono adapter supports legacy response envelopes for old Cloud clients.
- [x] Orders: `POST /api/v1/orders`, `GET /api/v1/orders`, `GET /api/v1/orders/:orderId`.
- [x] Payment links: `POST /api/v1/payment-links`, `GET /api/v1/payment-links`, `GET /api/v1/payment-links/:paymentLinkId`, `POST /api/v1/payment-links/:paymentLinkId/publish`.
- [x] API keys: old organization-scoped create/list/revoke paths.
- [x] Hosted config: `GET /api/v1/config`, `PUT /api/v1/config`.
- [x] Address pool: import, summary, list paths.
- [x] Webhooks: endpoint upsert and test delivery paths.
- [x] Runtime readiness/smoke: `/api/v1/readiness`, `/api/v1/smoke`.
- [x] Public status/checkout contracts: `/api/order-status/:orderId`, `/checkout/:slug` as runtime-bound JSON contracts.
- [x] HTTP-level integration test executes old `/api/v1` paths through real in-memory Cloud services/adapters, not mocks only.

## Evidence

- Hono adapter: `src/adapters/hono.ts`.
- HTTP adapter tests: `tests/unit/hono-adapter.test.ts`.
- Runtime flow test: `tests/integration/hono-runtime-flow.test.ts`.
- Default verification: `npm run verify`.
- PostgreSQL verification remains in `.github/workflows/disposable-integration.yml`.

## Still outside this layer

- Production deployment cutover.
- Replacing files inside the old `/data/openclaw/workspace/payin` repo.
- SSR HTML bundle ownership for checkout pages. This layer exposes runtime-bound data contracts; UI rendering can bind on top.
- Mainnet/customer-data operations.
