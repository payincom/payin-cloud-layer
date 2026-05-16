import { describe, expect, it } from 'vitest';
import {
  CloudApiKeyAuthenticator,
  createCloudServiceLayer,
  InMemoryCloudAddressPoolRepository,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudOrderRepository,
  InMemoryCloudPaymentLinkRepository,
  InMemoryCloudWebhookRepository,
  InMemoryUsageMeter,
  RepositoryBackedAddressPoolPort,
  RepositoryBackedOrderPort,
  RepositoryBackedPaymentLinkPort,
  StaticEntitlementProvider,
  StaticHostedConfigProvider,
  type CloudLayerPorts,
} from '../../src/index.js';

const tenant = { organizationId: 'org-factory', tenantId: 'org-factory', plan: 'pro' as const };

function ports(): CloudLayerPorts {
  const apiKeys = new InMemoryCloudApiKeyRepository([
    {
      presentedKey: 'pk_live_factory',
      apiKey: { id: 'key-factory', keyPrefix: 'pk_live_', name: 'Factory', organizationId: tenant.organizationId, role: 'admin' },
      membership: { role: 'admin', status: 'active' },
      tenant,
    },
  ]);
  return {
    tenantResolver: { resolveForUser: async () => ({ userId: 'user-1', tenant, role: 'admin', status: 'active' }) },
    apiKeys,
    hostedConfig: new StaticHostedConfigProvider({ enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'] }),
    orders: new RepositoryBackedOrderPort(new InMemoryCloudOrderRepository()),
    paymentLinks: new RepositoryBackedPaymentLinkPort(new InMemoryCloudPaymentLinkRepository()),
    addressPool: new RepositoryBackedAddressPoolPort(new InMemoryCloudAddressPoolRepository()),
    webhooks: new InMemoryCloudWebhookRepository(),
    auditTrail: new InMemoryCloudAuditTrail(),
    usageMeter: new InMemoryUsageMeter({ duplicatePolicy: 'ignore' }),
  };
}

describe('createCloudServiceLayer', () => {
  it('assembles service instances from CloudLayerPorts', async () => {
    const layer = createCloudServiceLayer({
      ports: ports(),
      entitlementProvider: new StaticEntitlementProvider(['orders:create', 'payment-links:create', 'payment-links:update', 'address-pool:import', 'address-pool:read', 'webhooks:test', 'webhooks:read', 'config:update']),
    });

    await expect(layer.orders.createOrder({ apiKey: 'pk_live_factory', orderReference: 'factory-1', amount: '10.00', currency: 'USDC', chainId: 'ethereum-sepolia' })).resolves.toMatchObject({ tenant });
    await expect(layer.paymentLinks.createPaymentLink({ apiKey: 'pk_live_factory', title: 'Factory Link', amount: '10.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'] })).resolves.toMatchObject({ tenant });
    await expect(layer.addressPool.importAddresses({ apiKey: 'pk_live_factory', protocol: 'evm', addresses: [{ address: '0xfac7000000000000000000000000000000000001' }] })).resolves.toMatchObject([{ tenant }]);
    await expect(layer.webhooks.upsertEndpoint({ apiKey: 'pk_live_factory', id: 'wh-factory', url: 'https://merchant.example/webhooks', eventTypes: ['webhook.tested'], signingSecretRef: 'secret://webhooks/factory', enabled: true })).resolves.toMatchObject({ tenant });
  });

  it('allows callers to inject a shared authenticator', () => {
    const layer = createCloudServiceLayer({
      ports: ports(),
      entitlementProvider: new StaticEntitlementProvider(['orders:create']),
      authenticator: new CloudApiKeyAuthenticator(new InMemoryCloudApiKeyRepository([])),
    });

    expect(layer.addressPool).toBeDefined();
    expect(layer.orders).toBeDefined();
    expect(layer.paymentLinks).toBeDefined();
    expect(layer.webhooks).toBeDefined();
  });
});
