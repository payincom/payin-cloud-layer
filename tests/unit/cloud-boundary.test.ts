import { describe, expect, it } from 'vitest';
import {
  CloudTenantAccessError,
  InMemoryCloudTenantResolver,
  StaticHostedConfigProvider,
  normalizeCloudTenantContext,
  resolveActiveCloudTenant,
} from '../../src/index.js';

describe('Cloud overlay boundary utilities', () => {
  it('normalizes tenantId to organizationId for current storage compatibility', () => {
    expect(normalizeCloudTenantContext({ organizationId: ' org-1 ', label: 'Tenant' })).toEqual({
      organizationId: 'org-1',
      tenantId: 'org-1',
      label: 'Tenant',
    });
  });

  it('resolves only active tenant memberships', async () => {
    const resolver = new InMemoryCloudTenantResolver([
      { userId: 'user-1', tenant: { organizationId: 'org-1', plan: 'pro' }, role: 'admin', status: 'active' },
      { userId: 'user-2', tenant: { organizationId: 'org-2' }, role: 'viewer', status: 'suspended' },
    ]);

    await expect(resolveActiveCloudTenant(resolver, 'user-1', 'org-1')).resolves.toMatchObject({
      organizationId: 'org-1',
      tenantId: 'org-1',
      plan: 'pro',
    });
    await expect(resolveActiveCloudTenant(resolver, 'user-2', 'org-2')).rejects.toBeInstanceOf(CloudTenantAccessError);
    await expect(resolveActiveCloudTenant(resolver, 'user-3', 'org-1')).rejects.toBeInstanceOf(CloudTenantAccessError);
  });

  it('keeps hosted config behind an adapter interface', async () => {
    const provider = new StaticHostedConfigProvider({
      enabledChains: ['ethereum-sepolia'],
      limits: { monthlyOrderLimit: 1000 },
      webhookSecretRef: 'secret://tenant/webhook',
    });

    expect(await provider.getTenantConfig({ organizationId: 'org-1' })).toEqual({
      tenant: { organizationId: 'org-1' },
      enabledChains: ['ethereum-sepolia'],
      limits: { monthlyOrderLimit: 1000 },
      webhookSecretRef: 'secret://tenant/webhook',
    });
  });
});
