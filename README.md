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
- `CloudOrderService`, `CloudPaymentLinkService`, `CloudWebhookService`: API-route-ready services that compose API-key auth, entitlements, hosted config, repositories, usage, and audit.
- `createCloudServiceLayer`: factory that assembles the route service layer from `CloudLayerPorts`.

## Development

```bash
npm install --no-package-lock
npm run verify
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md).

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

## Boundary rule

Cloud code belongs here. Do not put Cloud-only processors/managers/routes into `payin-open`. When old Cloud repo business code is needed, extract it behind interfaces in this repository instead of bulk-copying route/database coupling.
