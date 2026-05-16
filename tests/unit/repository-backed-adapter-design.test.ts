import { describe, expect, it } from 'vitest';
import {
  CloudLayerApplication,
  InMemoryCloudAddressPoolRepository,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudOrderRepository,
  InMemoryCloudPaymentLinkRepository,
  InMemoryCloudTenantResolver,
  InMemoryCloudWebhookRepository,
  InMemoryUsageMeter,
  RepositoryBackedAddressPoolPort,
  RepositoryBackedOrderPort,
  RepositoryBackedPaymentLinkPort,
  StaticHostedConfigProvider,
  createCloudLayerPorts,
  type CloudLayerPorts,
  type NormalizedCloudAddressPoolEntry,
  type NormalizedCloudOrder,
  type NormalizedCloudPaymentLink,
} from '../../src/index.js';

const tenantA = { organizationId: 'org-adapter-a', tenantId: 'org-adapter-a' };
const tenantB = { organizationId: 'org-adapter-b', tenantId: 'org-adapter-b' };

function createRepositoryBackedPorts(): CloudLayerPorts & {
  addressPool: RepositoryBackedAddressPoolPort;
  webhooks: InMemoryCloudWebhookRepository;
} {
  return createCloudLayerPorts({
    tenantResolver: new InMemoryCloudTenantResolver([
      { userId: 'user-a', tenant: tenantA, role: 'admin', status: 'active' },
    ]),
    apiKeys: new InMemoryCloudApiKeyRepository([]),
    hostedConfig: new StaticHostedConfigProvider({ enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'] }),
    orders: new RepositoryBackedOrderPort(new InMemoryCloudOrderRepository()),
    paymentLinks: new RepositoryBackedPaymentLinkPort(new InMemoryCloudPaymentLinkRepository()),
    addressPool: new RepositoryBackedAddressPoolPort(new InMemoryCloudAddressPoolRepository()),
    webhooks: new InMemoryCloudWebhookRepository(),
    auditTrail: new InMemoryCloudAuditTrail(),
    usageMeter: new InMemoryUsageMeter({ duplicatePolicy: 'ignore' }),
  }) as CloudLayerPorts & { addressPool: RepositoryBackedAddressPoolPort; webhooks: InMemoryCloudWebhookRepository };
}

describe('repository-backed CloudLayerPorts adapters', () => {
  it('wires repository-backed adapters into the CloudLayerPorts bundle', async () => {
    const ports = createRepositoryBackedPorts();
    const app = new CloudLayerApplication(ports);

    await expect(app.resolveTenantForUser('user-a', tenantA.organizationId)).resolves.toEqual(tenantA);
    expect(ports.orders).toBeInstanceOf(RepositoryBackedOrderPort);
    expect(ports.paymentLinks).toBeInstanceOf(RepositoryBackedPaymentLinkPort);
    expect(ports.addressPool).toBeInstanceOf(RepositoryBackedAddressPoolPort);
    expect(ports.webhooks).toBeInstanceOf(InMemoryCloudWebhookRepository);
  });

  it('keeps order adapter persistence tenant-scoped behind the order port', async () => {
    const ports = createRepositoryBackedPorts();

    const order = await ports.orders.create({
      tenant: tenantA,
      orderReference: 'merchant-order-1',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
    }) as NormalizedCloudOrder;

    await expect(ports.orders.get(order.id, tenantA)).resolves.toMatchObject({ id: order.id, tenant: tenantA });
    await expect(ports.orders.get(order.id, tenantB)).resolves.toBeNull();
    await expect(ports.orders.list(tenantA, { status: 'pending' })).resolves.toHaveLength(1);
    await expect(ports.orders.list(tenantB)).resolves.toHaveLength(0);
  });

  it('keeps payment-link adapter persistence tenant-scoped and updateable through the payment link port', async () => {
    const ports = createRepositoryBackedPorts();

    const link = await ports.paymentLinks.create({
      id: '',
      tenant: tenantA,
      title: 'Hosted checkout',
      amount: '25.50',
      currency: 'USDC',
      chainOptions: ['ethereum-sepolia'],
      status: 'draft',
    }) as NormalizedCloudPaymentLink;
    const published = await ports.paymentLinks.update(link.id, tenantA, { status: 'published', slug: 'hosted-checkout' }) as NormalizedCloudPaymentLink;

    expect(published).toMatchObject({ id: link.id, status: 'published', slug: 'hosted-checkout', tenant: tenantA });
    await expect(ports.paymentLinks.get(link.id, tenantB)).resolves.toBeNull();
    await expect(ports.paymentLinks.list(tenantA)).resolves.toHaveLength(1);
    await expect(ports.paymentLinks.update(link.id, tenantB, { status: 'archived' })).rejects.toThrow('Payment link not found');
  });

  it('keeps address-pool adapter imports, summaries, and deposit binding inside one tenant', async () => {
    const ports = createRepositoryBackedPorts();

    await ports.addressPool.import({
      tenant: tenantA,
      protocol: 'evm',
      addresses: [
        { address: '0x1111111111111111111111111111111111111111', derivationIndex: 0 },
        { address: '0x2222222222222222222222222222222222222222', derivationIndex: 1 },
      ],
      masterPublicKeyRef: 'secret://tenant-a/xpub',
      limit: 2,
    });
    const bound = await ports.addressPool.bindFirstIdle(tenantA, 'dep-1', 'order-1') as NormalizedCloudAddressPoolEntry;

    expect(bound).toMatchObject({ state: 'bound', depositReference: 'dep-1', orderId: 'order-1', tenant: tenantA });
    await expect(ports.addressPool.summary(tenantA)).resolves.toMatchObject({
      tenant: tenantA,
      totalAddresses: 2,
      protocols: [{ protocol: 'evm', total: 2, available: 1, bound: 1, reserved: 0 }],
    });
    await expect(ports.addressPool.summary(tenantB)).resolves.toMatchObject({ tenant: tenantB, totalAddresses: 0, protocols: [] });
    await expect(ports.addressPool.import({
      tenant: tenantA,
      protocol: 'evm',
      addresses: [{ address: '0x3333333333333333333333333333333333333333' }],
      limit: 2,
    })).rejects.toThrow('Address pool limit exceeded');
  });

  it('keeps webhook endpoint adapter persistence tenant-scoped behind the webhook repository port', async () => {
    const ports = createRepositoryBackedPorts();
    await ports.webhooks.upsert({
      id: 'wh-1',
      tenant: tenantA,
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://tenant-a/webhook',
      enabled: true,
    });
    await ports.webhooks.upsert({
      id: 'wh-2',
      tenant: tenantB,
      url: 'https://other.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://tenant-b/webhook',
      enabled: true,
    });

    expect((await ports.webhooks.listForTenant(tenantA)).map((endpoint) => endpoint.id)).toEqual(['wh-1']);
    await expect(ports.webhooks.getForTenant('wh-2', tenantA)).resolves.toBeNull();
    await expect(ports.webhooks.getForTenant('wh-2', tenantB)).resolves.toMatchObject({ id: 'wh-2', tenant: tenantB });
  });
});
