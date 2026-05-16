# PayIn Cloud Layer Architecture

PayIn Cloud Layer is the hosted SaaS overlay on top of PayIn Open/shared payment core.

## Boundary

PayIn Open remains the base product and hides tenant concepts behind a single-merchant facade. PayIn Cloud is additive:

```text
PayIn Open/shared payment core
  -> PayIn Cloud Layer overlay
    -> Hosted SaaS runtime, dashboard, billing, risk, support, SLA
```

Cloud Layer must not fork Open business logic. It should wrap shared public APIs and add hosted concerns at the Cloud boundary.

## Tenant context

Cloud operations are always tenant-explicit. The current storage compatibility key is `organizationId`; `tenantId` can diverge later when PayIn Cloud account models mature.

`CloudTenantResolver` mirrors the existing Cloud repository's organization membership model without importing its API routes or database implementation directly.

## Entitlements

`EntitlementProvider` gates SaaS features such as order creation, payment links, API keys, webhooks, address pools, and hosted config changes.

The default `AllowAllEntitlements` exists for local tests only. Production Cloud should inject a real entitlement provider backed by plan/subscription/risk policy.

## Billing and audit

`BillingUsageReporter` and `CloudAuditLogger` receive structured events. CloudManager defaults to `strict` side-effect policy because hosted billing/audit failures are compliance-sensitive. A caller may explicitly set `best-effort` for local/dev or future queue-backed retry flows.

## Hosted config

`HostedConfigProvider` abstracts Cloud-hosted runtime configuration and secret references. It should point to secret refs, not raw secrets.

## Route service layer

API routes should use the service layer rather than calling repositories directly:

```text
HTTP/SDK route
  -> CloudOrderService / CloudPaymentLinkService / CloudWebhookService
    -> CloudApiKeyAuthenticator
    -> EntitlementProvider
    -> HostedConfigProvider, when runtime chain/token config is required
    -> Repository-backed adapter
    -> UsageMeter
    -> CloudAuditTrail
```

`createCloudServiceLayer` assembles these services from `CloudLayerPorts`. This keeps tenant/auth/entitlement/billing/audit behavior centralized and makes future extraction from the old Cloud repo route-by-route instead of copying route/database coupling.

Current service coverage:

- `CloudOrderService.createOrder`
- `CloudPaymentLinkService.createPaymentLink`
- `CloudPaymentLinkService.publishPaymentLink`
- `CloudAddressPoolService.importAddresses`
- `CloudAddressPoolService.getSummary`
- `CloudWebhookService.upsertEndpoint`
- `CloudWebhookService.createTestDelivery`

## Route harness layer

Route harnesses are framework-neutral handlers that convert normalized HTTP-like requests into service calls:

- `createCloudOrderRouteHandlers`
- `createCloudPaymentLinkRouteHandlers`
- `createCloudAddressPoolRouteHandlers`
- `createCloudWebhookRouteHandlers`
- `createCloudRouteHandlers`

They intentionally do not resolve tenants or reimplement authorization. They only extract the bearer API key, map request body/params, call the service layer, and normalize route errors. Hono/Express/Fastify adapters should be thin wrappers around these handlers.

## Migration from current PayIn Cloud repo

Use the current `/data/openclaw/workspace/payin` Cloud repo as a source of business semantics, not as code to bulk-copy. Migrate one boundary at a time:

1. Model the interface in Cloud Layer.
2. Add contract tests proving tenant/entitlement/billing/audit behavior.
3. Adapt old Cloud implementation behind the interface.
4. Keep Open repo unchanged unless a shared public core API is genuinely missing.
