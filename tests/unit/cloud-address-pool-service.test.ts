import { describe, expect, it } from 'vitest';
import {
  CloudAddressPoolService,
  CloudApiKeyAuthenticator,
  InMemoryCloudAddressPoolRepository,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudSubscriptionRepository,
  InMemoryUsageMeter,
  RepositoryBackedAddressPoolPort,
  StaticEntitlementProvider,
  SubscriptionBillingLimitEnforcer,
} from '../../src/index.js';

const tenant = { organizationId: 'org-address-service', tenantId: 'org-address-service', plan: 'pro' as const };

function service(overrides: Partial<ConstructorParameters<typeof CloudAddressPoolService>[0]> = {}) {
  const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
  const auditTrail = new InMemoryCloudAuditTrail();
  const addressPool = new RepositoryBackedAddressPoolPort(new InMemoryCloudAddressPoolRepository());
  const apiKeys = new InMemoryCloudApiKeyRepository([
    {
      presentedKey: 'pk_live_addresses',
      apiKey: { id: 'key-address', keyPrefix: 'pk_live_', name: 'Addresses', organizationId: tenant.organizationId, userId: 'user-1', role: 'admin' },
      membership: { role: 'admin', status: 'active' },
      tenant,
    },
  ]);
  return {
    usageMeter,
    auditTrail,
    addressPool,
    service: new CloudAddressPoolService({
      authenticator: new CloudApiKeyAuthenticator(apiKeys),
      entitlementProvider: new StaticEntitlementProvider(['address-pool:import', 'address-pool:read']),
      addressPool,
      usageMeter,
      auditTrail,
      ...overrides,
    }),
  };
}

describe('CloudAddressPoolService', () => {
  it('imports tenant-scoped addresses through auth/entitlement/adapter/usage/audit', async () => {
    const setup = service();

    const imported = await setup.service.importAddresses({
      apiKey: 'pk_live_addresses',
      protocol: 'evm',
      addresses: [{ address: '0x1111111111111111111111111111111111111111', derivationIndex: 0 }],
      masterPublicKeyRef: 'secret://xpub/address-service',
      now: new Date('2026-05-16T23:30:00.000Z'),
    });

    expect(imported).toMatchObject([
      { tenant, protocol: 'evm', address: '0x1111111111111111111111111111111111111111', state: 'idle' },
    ]);
    expect(await setup.usageMeter.listUsage({ tenantId: tenant.organizationId })).toMatchObject([
      { type: 'address_pool.imported', subjectId: 'evm', quantity: 1 },
    ]);
    expect(await setup.auditTrail.list({ tenantId: tenant.organizationId, action: 'address-pool:import' })).toMatchObject([
      { action: 'address-pool:import', actor: { type: 'api_key', id: 'key-address' }, subjectId: 'evm' },
    ]);
  });

  it('returns address pool summaries through read entitlement', async () => {
    const setup = service();
    await setup.service.importAddresses({ apiKey: 'pk_live_addresses', protocol: 'evm', addresses: [{ address: '0x2222222222222222222222222222222222222222' }] });

    const summary = await setup.service.getSummary({ apiKey: 'pk_live_addresses' });

    expect(summary).toMatchObject({
      tenant,
      totalAddresses: 1,
      hasAddresses: true,
      protocols: [{ protocol: 'evm', total: 1, available: 1, bound: 0, reserved: 0 }],
    });
  });

  it('rejects missing import entitlement before adapter side effects', async () => {
    const setup = service({ entitlementProvider: new StaticEntitlementProvider(['address-pool:read']) });

    await expect(setup.service.importAddresses({
      apiKey: 'pk_live_addresses',
      protocol: 'evm',
      addresses: [{ address: '0x3333333333333333333333333333333333333333' }],
    })).rejects.toThrow('Tenant is not entitled to capability: address-pool:import');

    await expect(setup.addressPool.summary(tenant)).resolves.toMatchObject({ totalAddresses: 0 });
  });

  it('enforces subscription address-pool limits before adapter side effects', async () => {
    const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
    await usageMeter.recordUsage({ tenant, type: 'address_pool.imported', subjectId: 'evm-existing', quantity: 1, occurredAt: new Date('2026-05-16T00:00:00.000Z') });
    const setup = service({
      usageMeter,
      billingLimitEnforcer: new SubscriptionBillingLimitEnforcer({
        subscriptions: new InMemoryCloudSubscriptionRepository([{ tenant, status: 'active', plan: 'pro', limits: { addressPoolLimit: 2 } }]),
        usage: usageMeter,
      }),
    });

    await expect(setup.service.importAddresses({
      apiKey: 'pk_live_addresses',
      protocol: 'evm',
      addresses: [
        { address: '0x4444444444444444444444444444444444444444' },
        { address: '0x5555555555555555555555555555555555555555' },
      ],
      now: new Date('2026-05-17T00:00:00.000Z'),
    })).rejects.toThrow('Subscription usage limit exceeded: addressPoolLimit');

    await expect(setup.addressPool.summary(tenant)).resolves.toMatchObject({ totalAddresses: 0 });
  });
});
