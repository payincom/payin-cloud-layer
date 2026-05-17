import { describe, expect, it } from 'vitest';
import {
  CloudApiKeyAuthenticator,
  CloudApiKeyService,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudSubscriptionRepository,
  InMemoryUsageMeter,
  StaticEntitlementProvider,
  SubscriptionBillingLimitEnforcer,
} from '../../src/index.js';

const tenant = { organizationId: 'org-api-key-service', tenantId: 'org-api-key-service', plan: 'pro' as const };

function service(overrides: Partial<ConstructorParameters<typeof CloudApiKeyService>[0]> = {}) {
  const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
  const auditTrail = new InMemoryCloudAuditTrail();
  const apiKeys = new InMemoryCloudApiKeyRepository([
    {
      presentedKey: 'pk_live_admin',
      apiKey: { id: 'key-admin', keyPrefix: 'pk_live_', name: 'Admin', organizationId: tenant.organizationId, userId: 'user-admin', role: 'admin' },
      membership: { role: 'admin', status: 'active' },
      tenant,
    },
  ]);
  return {
    apiKeys,
    usageMeter,
    auditTrail,
    service: new CloudApiKeyService({
      authenticator: new CloudApiKeyAuthenticator(apiKeys),
      entitlementProvider: new StaticEntitlementProvider(['api-keys:create', 'api-keys:read', 'api-keys:revoke']),
      apiKeys,
      usageMeter,
      auditTrail,
      secretFactory: () => 'pk_live_generated_secret',
      idFactory: () => 'key-generated',
      ...overrides,
    }),
  };
}

describe('CloudApiKeyService', () => {
  it('creates API keys through auth/entitlement/repository/usage/audit', async () => {
    const setup = service();

    const created = await setup.service.createApiKey({
      apiKey: 'pk_live_admin',
      name: 'Checkout API',
      role: 'member',
      capabilities: ['orders:create'],
      now: new Date('2026-05-16T23:55:00.000Z'),
    });

    expect(created).toMatchObject({
      presentedKey: 'pk_live_generated_secret',
      apiKey: { id: 'key-generated', keyPrefix: 'pk_live_', name: 'Checkout API', organizationId: tenant.organizationId, role: 'member', capabilities: ['orders:create'] },
    });
    expect(await setup.apiKeys.findByPresentedKey('pk_live_generated_secret')).toMatchObject({ apiKey: { id: 'key-generated' }, tenant });
    expect(await setup.usageMeter.listUsage({ tenantId: tenant.organizationId })).toMatchObject([
      { type: 'api_key.created', subjectId: 'key-generated' },
    ]);
    expect(await setup.auditTrail.list({ tenantId: tenant.organizationId, action: 'api-keys:create' })).toMatchObject([
      { actor: { type: 'api_key', id: 'key-admin' }, subjectId: 'key-generated' },
    ]);
  });

  it('lists redacted tenant-scoped API keys', async () => {
    const setup = service();
    await setup.service.createApiKey({ apiKey: 'pk_live_admin', name: 'Checkout API', role: 'member' });

    const keys = await setup.service.listApiKeys({ apiKey: 'pk_live_admin' });

    expect(keys).toMatchObject([
      { id: 'key-admin', keyPrefix: 'pk_live_', name: 'Admin', organizationId: tenant.organizationId },
      { id: 'key-generated', keyPrefix: 'pk_live_', name: 'Checkout API', organizationId: tenant.organizationId },
    ]);
    expect(JSON.stringify(keys)).not.toContain('pk_live_admin');
    expect(JSON.stringify(keys)).not.toContain('pk_live_generated_secret');
  });

  it('revokes tenant-scoped API keys and records audit/usage', async () => {
    const setup = service();
    await setup.service.createApiKey({ apiKey: 'pk_live_admin', name: 'Checkout API', role: 'member' });

    const revoked = await setup.service.revokeApiKey({ apiKey: 'pk_live_admin', apiKeyId: 'key-generated', now: new Date('2026-05-16T23:56:00.000Z') });

    expect(revoked.revokedAt).toEqual(new Date('2026-05-16T23:56:00.000Z'));
    expect(await setup.usageMeter.listUsage({ tenantId: tenant.organizationId })).toMatchObject([
      { type: 'api_key.created', subjectId: 'key-generated' },
      { type: 'api_key.revoked', subjectId: 'key-generated' },
    ]);
    expect(await setup.auditTrail.list({ tenantId: tenant.organizationId, action: 'api-keys:revoke' })).toMatchObject([
      { actor: { type: 'api_key', id: 'key-admin' }, subjectId: 'key-generated' },
    ]);
  });

  it('rejects missing entitlement before repository side effects', async () => {
    const setup = service({ entitlementProvider: new StaticEntitlementProvider(['api-keys:read']) });

    await expect(setup.service.createApiKey({ apiKey: 'pk_live_admin', name: 'Checkout API' })).rejects.toThrow('Tenant is not entitled to capability: api-keys:create');
    expect(await setup.apiKeys.listForTenant(tenant)).toHaveLength(1);
  });

  it('enforces subscription API-key limits before repository side effects', async () => {
    const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
    await usageMeter.recordUsage({ tenant, type: 'api_key.created', subjectId: 'existing-key', occurredAt: new Date('2026-05-16T00:00:00.000Z') });
    const setup = service({
      usageMeter,
      billingLimitEnforcer: new SubscriptionBillingLimitEnforcer({
        subscriptions: new InMemoryCloudSubscriptionRepository([{ tenant, status: 'active', plan: 'pro', limits: { apiKeyLimit: 1 } }]),
        usage: usageMeter,
      }),
    });

    await expect(setup.service.createApiKey({ apiKey: 'pk_live_admin', name: 'Checkout API', now: new Date('2026-05-17T00:00:00.000Z') })).rejects.toThrow('Subscription usage limit exceeded: apiKeyLimit');
    expect(await setup.apiKeys.listForTenant(tenant)).toHaveLength(1);
  });
});
