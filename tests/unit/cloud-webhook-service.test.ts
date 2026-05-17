import { describe, expect, it } from 'vitest';
import {
  CloudApiKeyAuthenticator,
  CloudWebhookService,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudSubscriptionRepository,
  InMemoryCloudWebhookRepository,
  InMemoryUsageMeter,
  StaticCloudWebhookSigner,
  StaticEntitlementProvider,
  SubscriptionBillingLimitEnforcer,
} from '../../src/index.js';

const tenant = { organizationId: 'org-webhook-service', tenantId: 'org-webhook-service', plan: 'pro' as const };

function service(overrides: Partial<ConstructorParameters<typeof CloudWebhookService>[0]> = {}) {
  const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
  const auditTrail = new InMemoryCloudAuditTrail();
  const webhooks = new InMemoryCloudWebhookRepository();
  const apiKeys = new InMemoryCloudApiKeyRepository([
    {
      presentedKey: 'pk_live_webhooks',
      apiKey: { id: 'key-wh', keyPrefix: 'pk_live_', name: 'Webhooks', organizationId: tenant.organizationId, userId: 'user-1', role: 'admin' },
      membership: { role: 'admin', status: 'active' },
      tenant,
    },
  ]);
  return {
    usageMeter,
    auditTrail,
    webhooks,
    service: new CloudWebhookService({
      authenticator: new CloudApiKeyAuthenticator(apiKeys),
      entitlementProvider: new StaticEntitlementProvider(['config:update', 'webhooks:test', 'webhooks:read']),
      webhooks,
      signer: new StaticCloudWebhookSigner('sig-service'),
      usageMeter,
      auditTrail,
      ...overrides,
    }),
  };
}

describe('CloudWebhookService', () => {
  it('upserts tenant-scoped endpoints through auth/entitlement/audit', async () => {
    const setup = service();

    const endpoint = await setup.service.upsertEndpoint({
      apiKey: 'pk_live_webhooks',
      id: 'wh-service',
      url: 'https://merchant.example/webhooks/payin',
      eventTypes: ['order.created'],
      signingSecretRef: 'secret://webhooks/wh-service',
      enabled: true,
      now: new Date('2026-05-16T23:20:00.000Z'),
    });

    expect(endpoint).toMatchObject({ id: 'wh-service', tenant, url: 'https://merchant.example/webhooks/payin' });
    expect(await setup.auditTrail.list({ tenantId: tenant.organizationId, action: 'config:update' })).toMatchObject([
      { subjectId: 'wh-service', actor: { type: 'api_key', id: 'key-wh' } },
    ]);
  });

  it('creates signed webhook test deliveries and records usage/audit', async () => {
    const setup = service();
    await setup.service.upsertEndpoint({ apiKey: 'pk_live_webhooks', id: 'wh-service', url: 'https://merchant.example/webhooks/payin', eventTypes: ['webhook.tested'], signingSecretRef: 'secret://webhooks/wh-service', enabled: true });

    const delivery = await setup.service.createTestDelivery({
      apiKey: 'pk_live_webhooks',
      endpointId: 'wh-service',
      eventId: 'evt-test-1',
      now: new Date('2026-05-16T23:21:00.000Z'),
    });

    expect(delivery).toMatchObject({
      endpointId: 'wh-service',
      url: 'https://merchant.example/webhooks/payin',
      headers: { 'payin-signature': 'sig-service', 'payin-event-type': 'webhook.tested' },
    });
    expect(JSON.parse(delivery.body)).toMatchObject({ id: 'evt-test-1', type: 'webhook.tested' });
    expect(await setup.usageMeter.listUsage({ tenantId: tenant.organizationId })).toMatchObject([
      { type: 'webhook.endpoint_upserted', subjectId: 'wh-service' },
      { type: 'webhook.tested', subjectId: 'wh-service' },
    ]);
    expect(await setup.auditTrail.list({ tenantId: tenant.organizationId, action: 'webhooks:test' })).toMatchObject([
      { subjectId: 'wh-service', actor: { type: 'api_key', id: 'key-wh' } },
    ]);
  });

  it('does not expose endpoints across tenants', async () => {
    const setup = service();

    await expect(setup.service.createTestDelivery({ apiKey: 'pk_live_webhooks', endpointId: 'missing' })).rejects.toThrow('Webhook endpoint not found: missing');
  });

  it('enforces subscription webhook endpoint limits before repository side effects', async () => {
    const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
    await usageMeter.recordUsage({ tenant, type: 'webhook.endpoint_upserted', subjectId: 'existing-webhook', occurredAt: new Date('2026-05-16T00:00:00.000Z') });
    const setup = service({
      usageMeter,
      billingLimitEnforcer: new SubscriptionBillingLimitEnforcer({
        subscriptions: new InMemoryCloudSubscriptionRepository([{ tenant, status: 'active', plan: 'pro', limits: { webhookEndpointLimit: 1 } }]),
        usage: usageMeter,
      }),
    });

    await expect(setup.service.upsertEndpoint({
      apiKey: 'pk_live_webhooks',
      id: 'wh-limited',
      url: 'https://merchant.example/webhooks/limited',
      eventTypes: ['order.created'],
      signingSecretRef: 'secret://webhooks/limited',
      enabled: true,
      now: new Date('2026-05-17T00:00:00.000Z'),
    })).rejects.toThrow('Subscription usage limit exceeded: webhookEndpointLimit');

    await expect(setup.webhooks.listForTenant(tenant)).resolves.toHaveLength(0);
  });
});
