import { describe, expect, it } from 'vitest';
import {
  CloudAddressPoolService,
  CloudApiKeyAuthenticator,
  CloudApiKeyService,
  CloudHostedConfigService,
  CloudOrderService,
  CloudPaymentLinkService,
  CloudWebhookService,
  InMemoryCloudAddressPoolRepository,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudOrderRepository,
  InMemoryCloudPaymentLinkRepository,
  InMemoryCloudWebhookRepository,
  InMemoryHostedConfigRepository,
  InMemoryUsageMeter,
  RepositoryBackedAddressPoolPort,
  RepositoryBackedOrderPort,
  RepositoryBackedPaymentLinkPort,
  StaticCloudWebhookSigner,
  StaticEntitlementProvider,
  createCloudHonoApp,
  createRuntimeReadinessReport,
} from '../../src/index.js';

const tenant = { organizationId: 'org-hono-runtime', tenantId: 'org-hono-runtime', plan: 'pro' as const };
const adminKey = 'pk_live_hono_runtime';
const authHeader = { authorization: `Bearer ${adminKey}`, 'content-type': 'application/json' };

function jsonRequest(method: string, body?: unknown): RequestInit {
  return { method, headers: authHeader, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}

async function json(response: Response | Promise<Response>): Promise<unknown> {
  return (await response).json();
}

describe('Cloud Hono runtime flow', () => {
  it('runs old /api/v1 HTTP paths through real Cloud services and in-memory adapters', async () => {
    const apiKeys = new InMemoryCloudApiKeyRepository([
      {
        presentedKey: adminKey,
        apiKey: { id: 'key-admin', keyPrefix: 'pk_live_', name: 'Admin', organizationId: tenant.organizationId, userId: 'user-admin', role: 'admin' },
        membership: { role: 'admin', status: 'active' },
        tenant,
      },
    ]);
    const authenticator = new CloudApiKeyAuthenticator(apiKeys);
    const entitlementProvider = new StaticEntitlementProvider([
      'orders:create', 'orders:read',
      'payment-links:create', 'payment-links:update', 'payment-links:read',
      'address-pool:import', 'address-pool:read',
      'api-keys:create', 'api-keys:read', 'api-keys:revoke',
      'config:read', 'config:update',
      'webhooks:test', 'webhooks:read',
    ]);
    const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
    const auditTrail = new InMemoryCloudAuditTrail();
    const hostedConfig = new InMemoryHostedConfigRepository({ enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'] });
    const orders = new RepositoryBackedOrderPort(new InMemoryCloudOrderRepository());
    const paymentLinks = new RepositoryBackedPaymentLinkPort(new InMemoryCloudPaymentLinkRepository());
    const addressPool = new RepositoryBackedAddressPoolPort(new InMemoryCloudAddressPoolRepository());
    const webhooks = new InMemoryCloudWebhookRepository();

    const app = createCloudHonoApp({
      legacyEnvelopes: true,
      services: {
        orders: new CloudOrderService({ authenticator, entitlementProvider, hostedConfig, orders, usageMeter, auditTrail }),
        paymentLinks: new CloudPaymentLinkService({ authenticator, entitlementProvider, hostedConfig, paymentLinks, usageMeter, auditTrail }),
        addressPool: new CloudAddressPoolService({ authenticator, entitlementProvider, addressPool, usageMeter, auditTrail }),
        webhooks: new CloudWebhookService({ authenticator, entitlementProvider, webhooks, signer: new StaticCloudWebhookSigner('sig-runtime'), usageMeter, auditTrail }),
        apiKeys: new CloudApiKeyService({ authenticator, entitlementProvider, apiKeys, usageMeter, auditTrail, secretFactory: () => 'pk_live_runtime_created', idFactory: () => 'key-created' }),
        configs: new CloudHostedConfigService({ authenticator, entitlementProvider, configs: hostedConfig, auditTrail }),
        readiness: {
          getReadiness: () => createRuntimeReadinessReport({ tenant, checks: [{ name: 'config', status: 'pass' }] }),
          runSmoke: () => createRuntimeReadinessReport({ tenant, checks: [{ name: 'orders.create', status: 'pass' }, { name: 'webhooks.test', status: 'pass' }] }),
        },
      },
    });

    const createdOrder = await json(app.request('/api/v1/orders', jsonRequest('POST', { orderReference: 'runtime-order-1', amount: '10.00', currency: 'USDC', chainId: 'ethereum-sepolia' })));
    expect(createdOrder).toMatchObject({ data: { id: 'order-1', tenant, orderReference: 'runtime-order-1' } });
    await expect(json(app.request('/api/v1/orders/order-1', { headers: { authorization: `Bearer ${adminKey}` } }))).resolves.toMatchObject({ data: { id: 'order-1', orderReference: 'runtime-order-1' } });

    const createdLink = await json(app.request('/api/v1/payment-links', jsonRequest('POST', { title: 'Runtime checkout', amount: '25.50', currency: 'USDC', chainOptions: ['ethereum-sepolia'] })));
    expect(createdLink).toMatchObject({ data: { id: 'plink-1', title: 'Runtime checkout', status: 'draft' } });
    await expect(json(app.request('/api/v1/payment-links/plink-1/publish', jsonRequest('POST', { slug: 'runtime-checkout' })))).resolves.toMatchObject({ data: { id: 'plink-1', status: 'published', slug: 'runtime-checkout' } });

    await expect(json(app.request('/api/v1/address-pool/import', jsonRequest('POST', { protocol: 'evm', addresses: [{ address: '0x1111111111111111111111111111111111111111' }] })))).resolves.toMatchObject({ data: [{ address: '0x1111111111111111111111111111111111111111', state: 'idle' }] });
    await expect(json(app.request('/api/v1/address-pool/summary', { headers: { authorization: `Bearer ${adminKey}` } }))).resolves.toMatchObject({ data: { totalAddresses: 1, hasAddresses: true } });

    await expect(json(app.request('/api/v1/organizations/org-hono-runtime/api-keys', jsonRequest('POST', { name: 'Runtime child key', role: 'member', capabilities: ['orders:create'] })))).resolves.toEqual({ apiKey: 'pk_live_runtime_created', metadata: expect.objectContaining({ id: 'key-created', name: 'Runtime child key' }) });
    await expect(json(app.request('/api/v1/config', { headers: { authorization: `Bearer ${adminKey}` } }))).resolves.toMatchObject({ config: { tenant, enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'] } });

    await expect(json(app.request('/api/v1/webhooks/endpoints', jsonRequest('POST', { id: 'wh-runtime', url: 'https://merchant.example/webhook', eventTypes: ['webhook.tested'], signingSecretRef: 'secret://runtime/webhook', enabled: true })))).resolves.toMatchObject({ endpoint: { id: 'wh-runtime', tenant } });
    await expect(json(app.request('/api/v1/webhooks/endpoints/wh-runtime/test', jsonRequest('POST', { eventId: 'evt-runtime' })))).resolves.toMatchObject({ data: { endpointId: 'wh-runtime', headers: { 'payin-signature': 'sig-runtime' } } });
    await expect(json(app.request('/api/v1/smoke', jsonRequest('POST')))).resolves.toMatchObject({ data: { status: 'pass', totals: { pass: 2, warn: 0, fail: 0 } } });

    expect(await usageMeter.listUsage({ tenantId: tenant.organizationId })).toMatchObject([
      { type: 'order.created' },
      { type: 'payment_link.created' },
      { type: 'address_pool.imported' },
      { type: 'api_key.created' },
      { type: 'webhook.endpoint_upserted' },
      { type: 'webhook.tested' },
    ]);
  });
});
