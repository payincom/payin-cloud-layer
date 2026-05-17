# PayIn Cloud Layer

PayIn Cloud Layer is the hosted SaaS overlay repository for PayIn.

It must not become a fork of PayIn Open. PayIn Open is the complete free/self-hostable base product; Cloud Layer composes the shared payment core with hosted SaaS concerns.

## Responsibilities

- Explicit Cloud tenant / organization context adapters
- Entitlement checks for hosted plans and policies
- Billing usage reporting hooks
- Cloud audit logging hooks
- Hosted configuration and secret reference providers
- Migration home for code gradually extracted from the current PayIn Cloud repo

## Current package surface

- `CloudProcessor`: tenant-explicit adapter over the shared processor compatibility layer.
- `CloudManager`: manager overlay that injects tenant scope and wraps operations with entitlement, billing, and audit hooks.
- `CloudTenantResolver`: route/runtime adapter interface for resolving active tenant membership.
- `HostedConfigProvider`: hosted config abstraction using secret refs rather than raw secrets.
- `createCloudConfigDiagnostics`: hosted diagnostics payload builder that preserves old Cloud diagnostics shape while sanitizing configured secrets.
- `createPublicOrderStatusView` / `createPublicPaymentLinkCheckoutView`: public checkout/status contracts extracted from old Cloud route behavior without binding this package to an SSR framework.
- `CloudOrderService`, `CloudPaymentLinkService`, `CloudAddressPoolService`, `CloudWebhookService`: API-route-ready payment operation services that compose API-key auth, entitlements, hosted config, optional subscription billing-limit enforcement, repositories, usage, and audit. Order and payment-link services expose create/read/list route harness coverage for old Cloud API migration.
- `CloudApiKeyService`, `CloudOrganizationService`, `CloudHostedConfigService`: Cloud SaaS management services for API keys, organization/member administration, and hosted config.
- `createCloudServiceLayer`: factory that assembles the route service layer from `CloudLayerPorts`.

## Development

```bash
npm install --no-package-lock
npm run verify
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md).
See [`docs/first-layer-acceptance.md`](docs/first-layer-acceptance.md) for the completed first-layer Cloud Overlay acceptance scope.
See [`docs/second-layer-runtime-acceptance.md`](docs/second-layer-runtime-acceptance.md) for the Hono runtime binding and HTTP-level migration scope.

## Service layer example

```ts
import { createCloudServiceLayer } from '@payin/cloud-layer';

const services = createCloudServiceLayer({
  ports,
  entitlementProvider,
  webhookSigner,
});

await services.orders.createOrder({
  apiKey: request.headers.authorization,
  orderReference: 'merchant-order-1',
  amount: '10.00',
  currency: 'USDC',
  chainId: 'ethereum-sepolia',
});
```

Routes should stay thin: parse request input, call a Cloud service, then serialize the response. Tenant/auth/entitlement/usage/audit behavior belongs in this package rather than duplicated in route handlers.

For framework adapters, use the route harness factory:

```ts
import { createCloudRouteHandlers } from '@payin/cloud-layer';

const routes = createCloudRouteHandlers({ services });
// Hono/Express/Fastify handlers can adapt HTTP objects into routes.orders.createOrder(...)
```

Old PayIn Cloud `/api/v1` clients can wrap route harness responses with `toLegacyCloudRouteResponse(...)` when they need legacy envelopes such as `{ apiKey, metadata }`, `{ config }`, or `{ endpoint }` instead of the newer route `{ data }` envelope.

For Hono runtimes, use the concrete adapter:

```ts
import { createCloudHonoApp } from '@payin/cloud-layer';

const app = createCloudHonoApp({
  services,
  legacyEnvelopes: true,
  publicCheckout,
});
```

## Boundary rule

Cloud code belongs here. Do not put Cloud-only processors/managers/routes into `payin-open`. When old Cloud repo business code is needed, extract it behind interfaces in this repository instead of bulk-copying route/database coupling.
