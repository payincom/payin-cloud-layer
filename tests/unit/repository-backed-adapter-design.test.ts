import { describe, expect, it } from 'vitest';
import {
  CloudLayerApplication,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudTenantResolver,
  InMemoryUsageMeter,
  StaticHostedConfigProvider,
  bindCloudDepositAddress,
  createAddressPoolSummary,
  createCloudLayerPorts,
  createCloudOrderDraft,
  importCloudAddressPoolDraft,
  normalizeCloudAddressPoolEntry,
  normalizeCloudOrder,
  normalizeCloudPaymentLink,
  normalizeCloudWebhookEndpoint,
  type CloudAddressPoolEntry,
  type CloudAddressPoolPort,
  type CloudLayerPorts,
  type CloudOrder,
  type CloudOrderDraftInput,
  type CloudOrderPort,
  type CloudPaymentLink,
  type CloudPaymentLinkPort,
  type CloudTenantContext,
  type CloudWebhookEndpoint,
  type CloudWebhookEndpointInput,
  type CloudWebhookEndpointRepository,
  type NormalizedCloudAddressPoolEntry,
  type NormalizedCloudOrder,
  type NormalizedCloudPaymentLink,
} from '../../src/index.js';

const tenantA = { organizationId: 'org-adapter-a', tenantId: 'org-adapter-a' };
const tenantB = { organizationId: 'org-adapter-b', tenantId: 'org-adapter-b' };

class FakeOrderRepository {
  private readonly records = new Map<string, NormalizedCloudOrder>();
  private sequence = 0;

  save(order: CloudOrder): NormalizedCloudOrder {
    const normalized = normalizeCloudOrder({
      ...order,
      id: order.id || `order-${++this.sequence}`,
      createdAt: order.createdAt ?? new Date('2026-05-16T13:00:00.000Z'),
      updatedAt: new Date('2026-05-16T13:00:00.000Z'),
    });
    this.records.set(normalized.id, normalized);
    return normalized;
  }

  findByTenant(orderId: string, tenant: CloudTenantContext): NormalizedCloudOrder | null {
    const record = this.records.get(orderId);
    return record?.tenant.organizationId === tenant.organizationId ? record : null;
  }

  listByTenant(tenant: CloudTenantContext, filters: Record<string, unknown> = {}): NormalizedCloudOrder[] {
    return [...this.records.values()].filter((record) =>
      record.tenant.organizationId === tenant.organizationId
      && (!filters.status || record.status === filters.status)
    );
  }
}

class RepositoryBackedOrderPort implements CloudOrderPort {
  constructor(private readonly repository: FakeOrderRepository) {}

  create(request: CloudOrderDraftInput): NormalizedCloudOrder {
    const draft = createCloudOrderDraft(request);
    return this.repository.save({
      ...draft,
      id: '',
      tenant: draft.tenant,
      confirmedReceived: draft.confirmedReceived ?? '0',
    });
  }

  get(orderId: string, tenant: CloudTenantContext): NormalizedCloudOrder | null {
    return this.repository.findByTenant(orderId, tenant);
  }

  list(tenant: CloudTenantContext, filters?: Record<string, unknown>): NormalizedCloudOrder[] {
    return this.repository.listByTenant(tenant, filters);
  }
}

class FakePaymentLinkRepository {
  private readonly records = new Map<string, NormalizedCloudPaymentLink>();
  private sequence = 0;

  save(link: CloudPaymentLink): NormalizedCloudPaymentLink {
    const normalized = normalizeCloudPaymentLink({
      ...link,
      id: link.id || `plink-${++this.sequence}`,
      createdAt: link.createdAt ?? new Date('2026-05-16T13:05:00.000Z'),
      updatedAt: new Date('2026-05-16T13:05:00.000Z'),
    });
    this.records.set(normalized.id, normalized);
    return normalized;
  }

  findByTenant(paymentLinkId: string, tenant: CloudTenantContext): NormalizedCloudPaymentLink | null {
    const record = this.records.get(paymentLinkId);
    return record?.tenant.organizationId === tenant.organizationId ? record : null;
  }

  listByTenant(tenant: CloudTenantContext): NormalizedCloudPaymentLink[] {
    return [...this.records.values()].filter((record) => record.tenant.organizationId === tenant.organizationId);
  }
}

class RepositoryBackedPaymentLinkPort implements CloudPaymentLinkPort {
  constructor(private readonly repository: FakePaymentLinkRepository) {}

  create(request: CloudPaymentLink): NormalizedCloudPaymentLink {
    return this.repository.save(request);
  }

  get(paymentLinkId: string, tenant: CloudTenantContext): NormalizedCloudPaymentLink | null {
    return this.repository.findByTenant(paymentLinkId, tenant);
  }

  list(tenant: CloudTenantContext): NormalizedCloudPaymentLink[] {
    return this.repository.listByTenant(tenant);
  }

  update(paymentLinkId: string, tenant: CloudTenantContext, updates: Partial<CloudPaymentLink>): NormalizedCloudPaymentLink {
    const existing = this.repository.findByTenant(paymentLinkId, tenant);
    if (!existing) throw new Error(`Payment link not found: ${paymentLinkId}`);
    return this.repository.save({ ...existing, ...updates, id: existing.id, tenant: existing.tenant });
  }
}

class FakeAddressPoolRepository {
  private readonly records: NormalizedCloudAddressPoolEntry[] = [];

  import(entries: CloudAddressPoolEntry[]): NormalizedCloudAddressPoolEntry[] {
    const normalized = entries.map(normalizeCloudAddressPoolEntry);
    this.records.push(...normalized);
    return normalized;
  }

  listByTenant(tenant: CloudTenantContext): NormalizedCloudAddressPoolEntry[] {
    return this.records.filter((record) => record.tenant.organizationId === tenant.organizationId);
  }

  replace(entry: CloudAddressPoolEntry): NormalizedCloudAddressPoolEntry {
    const normalized = normalizeCloudAddressPoolEntry(entry);
    const index = this.records.findIndex((record) =>
      record.tenant.organizationId === normalized.tenant.organizationId && record.address === normalized.address
    );
    if (index === -1) throw new Error(`Address not found: ${normalized.address}`);
    this.records[index] = normalized;
    return normalized;
  }
}

class RepositoryBackedAddressPoolPort implements CloudAddressPoolPort {
  constructor(private readonly repository: FakeAddressPoolRepository) {}

  import(request: {
    tenant: CloudTenantContext;
    protocol: string;
    addresses: Array<{ address: string; derivationIndex?: number | null }>;
    masterPublicKeyRef?: string;
    limit?: number | null;
  }): NormalizedCloudAddressPoolEntry[] {
    const existingCount = this.repository.listByTenant(request.tenant).length;
    const draft = importCloudAddressPoolDraft({ ...request, existingCount });
    return this.repository.import(draft);
  }

  summary(tenant: CloudTenantContext) {
    return createAddressPoolSummary(this.repository.listByTenant(tenant), tenant);
  }

  bindFirstIdle(tenant: CloudTenantContext, depositReference: string, orderId: string): NormalizedCloudAddressPoolEntry {
    const entry = this.repository.listByTenant(tenant).find((candidate) => candidate.state === 'idle');
    if (!entry) throw new Error('No idle address is available');
    return this.repository.replace(bindCloudDepositAddress(entry, { depositReference, orderId }));
  }
}

class FakeWebhookEndpointRepository implements CloudWebhookEndpointRepository {
  private readonly records = new Map<string, CloudWebhookEndpoint>();

  upsert(input: CloudWebhookEndpointInput): CloudWebhookEndpoint {
    const endpoint = normalizeCloudWebhookEndpoint(input);
    this.records.set(endpoint.id, endpoint);
    return endpoint;
  }

  listForTenant(tenant: CloudTenantContext): CloudWebhookEndpoint[] {
    return [...this.records.values()].filter((endpoint) => endpoint.tenant.organizationId === tenant.organizationId);
  }

  getForTenant(endpointId: string, tenant: CloudTenantContext): CloudWebhookEndpoint | null {
    const endpoint = this.records.get(endpointId);
    return endpoint?.tenant.organizationId === tenant.organizationId ? endpoint : null;
  }
}

function createRepositoryBackedPorts(): CloudLayerPorts & {
  addressPool: RepositoryBackedAddressPoolPort;
  webhooks: FakeWebhookEndpointRepository;
} {
  return createCloudLayerPorts({
    tenantResolver: new InMemoryCloudTenantResolver([
      { userId: 'user-a', tenant: tenantA, role: 'admin', status: 'active' },
    ]),
    apiKeys: new InMemoryCloudApiKeyRepository([]),
    hostedConfig: new StaticHostedConfigProvider({ enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'] }),
    orders: new RepositoryBackedOrderPort(new FakeOrderRepository()),
    paymentLinks: new RepositoryBackedPaymentLinkPort(new FakePaymentLinkRepository()),
    addressPool: new RepositoryBackedAddressPoolPort(new FakeAddressPoolRepository()),
    webhooks: new FakeWebhookEndpointRepository(),
    auditTrail: new InMemoryCloudAuditTrail(),
    usageMeter: new InMemoryUsageMeter({ duplicatePolicy: 'ignore' }),
  }) as CloudLayerPorts & { addressPool: RepositoryBackedAddressPoolPort; webhooks: FakeWebhookEndpointRepository };
}

describe('repository-backed CloudLayerPorts adapter design', () => {
  it('wires fake repository-backed adapters into the CloudLayerPorts bundle', async () => {
    const ports = createRepositoryBackedPorts();
    const app = new CloudLayerApplication(ports);

    await expect(app.resolveTenantForUser('user-a', tenantA.organizationId)).resolves.toEqual(tenantA);
    expect(ports.orders).toBeInstanceOf(RepositoryBackedOrderPort);
    expect(ports.paymentLinks).toBeInstanceOf(RepositoryBackedPaymentLinkPort);
    expect(ports.addressPool).toBeInstanceOf(RepositoryBackedAddressPoolPort);
    expect(ports.webhooks).toBeInstanceOf(FakeWebhookEndpointRepository);
  });

  it('keeps order adapter persistence tenant-scoped behind the order port', () => {
    const ports = createRepositoryBackedPorts();

    const order = ports.orders.create({
      tenant: tenantA,
      orderReference: 'merchant-order-1',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
    }) as NormalizedCloudOrder;

    expect(ports.orders.get(order.id, tenantA)).toMatchObject({ id: order.id, tenant: tenantA });
    expect(ports.orders.get(order.id, tenantB)).toBeNull();
    expect(ports.orders.list(tenantA, { status: 'pending' })).toHaveLength(1);
    expect(ports.orders.list(tenantB)).toHaveLength(0);
  });

  it('keeps payment-link adapter persistence tenant-scoped and updateable through the payment link port', () => {
    const ports = createRepositoryBackedPorts();

    const link = ports.paymentLinks.create({
      id: '',
      tenant: tenantA,
      title: 'Hosted checkout',
      amount: '25.50',
      currency: 'USDC',
      chainOptions: ['ethereum-sepolia'],
      status: 'draft',
    }) as NormalizedCloudPaymentLink;
    const published = ports.paymentLinks.update(link.id, tenantA, { status: 'published', slug: 'hosted-checkout' }) as NormalizedCloudPaymentLink;

    expect(published).toMatchObject({ id: link.id, status: 'published', slug: 'hosted-checkout', tenant: tenantA });
    expect(ports.paymentLinks.get(link.id, tenantB)).toBeNull();
    expect(ports.paymentLinks.list(tenantA)).toHaveLength(1);
    expect(() => ports.paymentLinks.update(link.id, tenantB, { status: 'archived' })).toThrow('Payment link not found');
  });

  it('keeps address-pool adapter imports, summaries, and deposit binding inside one tenant', () => {
    const ports = createRepositoryBackedPorts();

    ports.addressPool.import({
      tenant: tenantA,
      protocol: 'evm',
      addresses: [
        { address: '0x1111111111111111111111111111111111111111', derivationIndex: 0 },
        { address: '0x2222222222222222222222222222222222222222', derivationIndex: 1 },
      ],
      masterPublicKeyRef: 'secret://tenant-a/xpub',
      limit: 2,
    });
    const bound = ports.addressPool.bindFirstIdle(tenantA, 'dep-1', 'order-1');

    expect(bound).toMatchObject({ state: 'bound', depositReference: 'dep-1', orderId: 'order-1', tenant: tenantA });
    expect(ports.addressPool.summary(tenantA)).toMatchObject({
      tenant: tenantA,
      totalAddresses: 2,
      protocols: [{ protocol: 'evm', total: 2, available: 1, bound: 1, reserved: 0 }],
    });
    expect(ports.addressPool.summary(tenantB)).toMatchObject({ tenant: tenantB, totalAddresses: 0, protocols: [] });
    expect(() => ports.addressPool.import({
      tenant: tenantA,
      protocol: 'evm',
      addresses: [{ address: '0x3333333333333333333333333333333333333333' }],
      limit: 2,
    })).toThrow('Address pool limit exceeded');
  });

  it('keeps webhook endpoint adapter persistence tenant-scoped behind the webhook repository port', async () => {
    const ports = createRepositoryBackedPorts();
    ports.webhooks.upsert({
      id: 'wh-1',
      tenant: tenantA,
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://tenant-a/webhook',
      enabled: true,
    });
    ports.webhooks.upsert({
      id: 'wh-2',
      tenant: tenantB,
      url: 'https://other.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://tenant-b/webhook',
      enabled: true,
    });

    expect((await ports.webhooks.listForTenant(tenantA)).map((endpoint) => endpoint.id)).toEqual(['wh-1']);
    expect(await ports.webhooks.getForTenant('wh-2', tenantA)).toBeNull();
    expect(await ports.webhooks.getForTenant('wh-2', tenantB)).toMatchObject({ id: 'wh-2', tenant: tenantB });
  });
});
