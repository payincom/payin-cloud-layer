import { describe, expect, it } from 'vitest';
import {
  CloudApiKeyAuthenticator,
  CloudHostedConfigService,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryHostedConfigRepository,
  StaticEntitlementProvider,
} from '../../src/index.js';

const tenant = { organizationId: 'org-config-service', tenantId: 'org-config-service', plan: 'pro' as const };

function service(entitlements: Array<'config:read' | 'config:update'> = ['config:read', 'config:update']) {
  const auditTrail = new InMemoryCloudAuditTrail();
  const configs = new InMemoryHostedConfigRepository({ enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'] });
  const apiKeys = new InMemoryCloudApiKeyRepository([
    {
      presentedKey: 'pk_live_config',
      apiKey: { id: 'key-config', keyPrefix: 'pk_live_', name: 'Config', organizationId: tenant.organizationId, userId: 'user-config', role: 'admin' },
      membership: { role: 'admin', status: 'active' },
      tenant,
    },
  ]);
  return {
    configs,
    auditTrail,
    service: new CloudHostedConfigService({
      authenticator: new CloudApiKeyAuthenticator(apiKeys),
      entitlementProvider: new StaticEntitlementProvider(entitlements),
      configs,
      auditTrail,
    }),
  };
}

describe('CloudHostedConfigService', () => {
  it('reads tenant hosted config through auth and entitlement', async () => {
    const setup = service();

    await expect(setup.service.getConfig({ apiKey: 'pk_live_config' })).resolves.toMatchObject({
      tenant,
      enabledChains: ['ethereum-sepolia'],
      enabledTokens: ['USDC'],
    });
  });

  it('updates hosted config through auth/entitlement/repository/audit', async () => {
    const setup = service();

    const updated = await setup.service.updateConfig({
      apiKey: 'pk_live_config',
      enabledChains: ['ethereum-sepolia', 'base-sepolia'],
      enabledTokens: ['USDC', 'EURC'],
      secretRefs: { webhookSigningSecretRef: 'secret://webhooks/config' },
      now: new Date('2026-05-17T00:35:00.000Z'),
    });

    expect(updated).toMatchObject({ enabledChains: ['ethereum-sepolia', 'base-sepolia'], enabledTokens: ['USDC', 'EURC'] });
    expect(await setup.auditTrail.list({ tenantId: tenant.organizationId, action: 'config:update' })).toMatchObject([
      { actor: { type: 'api_key', id: 'key-config' }, subjectId: tenant.organizationId, metadata: { resource: 'hosted_config' } },
    ]);
  });

  it('rejects missing update entitlement before repository side effects', async () => {
    const setup = service(['config:read']);

    await expect(setup.service.updateConfig({ apiKey: 'pk_live_config', enabledChains: ['base-sepolia'] })).rejects.toThrow('Tenant is not entitled to capability: config:update');
    expect(await setup.configs.getTenantConfig(tenant)).toMatchObject({ enabledChains: ['ethereum-sepolia'] });
  });
});
