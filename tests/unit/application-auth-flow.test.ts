import { describe, expect, it } from 'vitest';
import {
  CloudLayerApplication,
  CloudApiKeyAuthenticator,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudTenantResolver,
  createCloudLayerPorts,
  StaticHostedConfigProvider,
  InMemoryCloudAuditTrail,
  InMemoryUsageMeter,
  InMemoryCloudWebhookEndpointRepository,
} from '../../src/index.js';

const tenant = { organizationId: 'org-app-flow', tenantId: 'org-app-flow', plan: 'pro' as const };

function app() {
  const tenantResolver = new InMemoryCloudTenantResolver([
    { userId: 'user-1', tenant, role: 'admin', status: 'active' },
  ]);
  const apiKeys = new InMemoryCloudApiKeyRepository([
    {
      presentedKey: 'pk_live_app',
      apiKey: {
        id: 'key-1',
        keyPrefix: 'pk_live_',
        name: 'App key',
        organizationId: 'org-app-flow',
        userId: 'user-1',
        role: 'admin',
      },
      membership: { role: 'admin', status: 'active' },
      tenant,
    },
  ]);

  return new CloudLayerApplication(createCloudLayerPorts({
    tenantResolver,
    apiKeys,
    hostedConfig: new StaticHostedConfigProvider({ enabledChains: ['ethereum-sepolia'] }),
    orders: { create: async (request) => request, get: async () => null, list: async () => [] },
    paymentLinks: { create: async (request) => request, get: async () => null, list: async () => [], update: async () => null },
    addressPool: { import: async (request) => request, summary: async () => null },
    webhooks: new InMemoryCloudWebhookEndpointRepository([]),
    auditTrail: new InMemoryCloudAuditTrail(),
    usageMeter: new InMemoryUsageMeter(),
  }));
}

describe('CloudLayerApplication auth flow', () => {
  it('resolves user tenant and authenticates API keys through ports only', async () => {
    const application = app();

    await expect(application.resolveTenantForUser('user-1', 'org-app-flow')).resolves.toEqual(tenant);

    const authenticator = new CloudApiKeyAuthenticator(application.ports.apiKeys);
    await expect(authenticator.authenticate('pk_live_app', new Date('2026-05-16T14:10:00.000Z'))).resolves.toMatchObject({
      apiKeyId: 'key-1',
      tenant,
      role: 'admin',
      capabilities: expect.arrayContaining(['orders:create', 'config:update']),
    });
  });

  it('denies inactive tenant memberships before application code sees tenant context', async () => {
    const application = new CloudLayerApplication(createCloudLayerPorts({
      ...app().ports,
      tenantResolver: new InMemoryCloudTenantResolver([
        { userId: 'user-2', tenant, role: 'admin', status: 'suspended' },
      ]),
    }));

    await expect(application.resolveTenantForUser('user-2', 'org-app-flow')).rejects.toThrow(
      'User is not an active member of the requested Cloud tenant'
    );
  });
});
