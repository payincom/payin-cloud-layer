import { describe, expect, it, vi } from 'vitest';
import { CloudManager, type BillingUsageReporter, type CloudAuditLogger, type EntitlementProvider } from '../../src/index.js';
import { EntitlementDeniedError, StaticEntitlementProvider } from '../../src/index.js';

function createBackend() {
  return {
    createOrder: vi.fn(async (request) => ({ orderId: 'order-id', ...request })),
    getOrder: vi.fn(async (orderId, organizationId) => ({ orderId, organizationId })),
    listOrders: vi.fn(async (filters) => ({ orders: [], filters })),
    createPaymentLink: vi.fn(async (request) => ({ paymentLinkId: 'plink-id', ...request })),
    updatePaymentLink: vi.fn(async (paymentLinkId, organizationId, updates) => ({ paymentLinkId, organizationId, ...updates })),
    getPaymentLink: vi.fn(async (paymentLinkId, organizationId) => ({ paymentLinkId, organizationId })),
    listPaymentLinks: vi.fn(async (filters) => ({ links: [], filters })),
    createApiKey: vi.fn(async (request) => ({ id: 'key-id', ...request })),
    listApiKeys: vi.fn(async (organizationId) => ({ keys: [], organizationId })),
    revokeApiKey: vi.fn(async (apiKeyId, organizationId) => ({ apiKeyId, organizationId, revoked: true })),
    importAddressPool: vi.fn(async (request) => ({ imported: request.addresses.length, ...request })),
    getAddressPoolAvailability: vi.fn(async (organizationId, protocol) => ({ organizationId, protocol, available: 2 })),
    listWebhooks: vi.fn(async (organizationId) => ({ organizationId, webhooks: [] })),
    testWebhook: vi.fn(async (webhookId, organizationId) => ({ webhookId, organizationId, delivered: true })),
  };
}

const tenant = { organizationId: 'tenant-1', label: 'Tenant 1' };

describe('CloudManager', () => {
  it('requires an explicit tenant organization id', () => {
    expect(() => new CloudManager(createBackend(), { tenant: { organizationId: '   ' } })).toThrow(
      'Cloud tenant context with organizationId is required'
    );
  });

  it('injects tenant scope and records entitlement, billing, and audit for order creation', async () => {
    const backend = createBackend();
    const entitlementProvider: EntitlementProvider = { assertAllowed: vi.fn() };
    const billingUsageReporter: BillingUsageReporter = { recordUsage: vi.fn() };
    const auditLogger: CloudAuditLogger = { record: vi.fn() };
    const manager = new CloudManager(backend, {
      tenant,
      entitlementProvider,
      billingUsageReporter,
      auditLogger,
    });

    await manager.createOrder({ orderReference: 'cloud-1', amount: '10' });

    expect(entitlementProvider.assertAllowed).toHaveBeenCalledWith(
      { organizationId: 'tenant-1', tenantId: 'tenant-1', label: 'Tenant 1' },
      'orders:create'
    );
    expect(backend.createOrder).toHaveBeenCalledWith({
      orderReference: 'cloud-1',
      amount: '10',
      organizationId: 'tenant-1',
    });
    expect(billingUsageReporter.recordUsage).toHaveBeenCalledWith({
      tenant: { organizationId: 'tenant-1', tenantId: 'tenant-1', label: 'Tenant 1' },
      type: 'order.created',
      subjectId: 'order-id',
    });
    expect(auditLogger.record).toHaveBeenCalledWith({
      tenant: { organizationId: 'tenant-1', tenantId: 'tenant-1', label: 'Tenant 1' },
      action: 'orders:create',
      subjectId: 'order-id',
    });
  });

  it('keeps payment-link tenant scope and Cloud-only hooks in the overlay', async () => {
    const backend = createBackend();
    const billingUsageReporter: BillingUsageReporter = { recordUsage: vi.fn() };
    const auditLogger: CloudAuditLogger = { record: vi.fn() };
    const manager = new CloudManager(backend, {
      tenant: { organizationId: 'tenant-2' },
      billingUsageReporter,
      auditLogger,
    });

    await manager.createPaymentLink({ title: 'Hosted checkout' });
    await manager.updatePaymentLink('plink-id', { title: 'Updated' });
    await manager.listPaymentLinks({ status: 'active' });

    expect(backend.createPaymentLink).toHaveBeenCalledWith({ title: 'Hosted checkout', organizationId: 'tenant-2' });
    expect(backend.updatePaymentLink).toHaveBeenCalledWith('plink-id', 'tenant-2', { title: 'Updated' });
    expect(backend.listPaymentLinks).toHaveBeenCalledWith({ status: 'active', organizationId: 'tenant-2' });
    expect(billingUsageReporter.recordUsage).toHaveBeenCalledWith({
      tenant: { organizationId: 'tenant-2', tenantId: 'tenant-2' },
      type: 'payment_link.created',
      subjectId: 'plink-id',
    });
    expect(auditLogger.record).toHaveBeenCalledWith({
      tenant: { organizationId: 'tenant-2', tenantId: 'tenant-2' },
      action: 'payment-links:update',
      subjectId: 'plink-id',
    });
  });

  it('blocks backend calls when entitlement is denied', async () => {
    const backend = createBackend();
    const manager = new CloudManager(backend, {
      tenant,
      entitlementProvider: new StaticEntitlementProvider(['orders:read']),
    });

    await expect(manager.createOrder({ orderReference: 'blocked' })).rejects.toBeInstanceOf(EntitlementDeniedError);
    expect(backend.createOrder).not.toHaveBeenCalled();
  });

  it('supports best-effort audit/billing side effects when explicitly configured', async () => {
    const backend = createBackend();
    const sideEffectError = new Error('usage reporter unavailable');
    const onSideEffectError = vi.fn();
    const manager = new CloudManager(backend, {
      tenant,
      sideEffectPolicy: 'best-effort',
      onSideEffectError,
      billingUsageReporter: { recordUsage: vi.fn(() => { throw sideEffectError; }) },
    });

    await expect(manager.createOrder({ orderReference: 'best-effort' })).resolves.toMatchObject({ orderId: 'order-id' });
    expect(onSideEffectError).toHaveBeenCalledWith(sideEffectError);
  });

  it('fails Cloud requests on audit/billing errors by default', async () => {
    const manager = new CloudManager(createBackend(), {
      tenant,
      billingUsageReporter: { recordUsage: vi.fn(() => { throw new Error('billing failed'); }) },
    });

    await expect(manager.createOrder({ orderReference: 'strict' })).rejects.toThrow('billing failed');
  });

  it('wraps API keys, address pool, and webhook operations with tenant scope and hooks', async () => {
    const backend = createBackend();
    const billingUsageReporter: BillingUsageReporter = { recordUsage: vi.fn() };
    const auditLogger: CloudAuditLogger = { record: vi.fn() };
    const manager = new CloudManager(backend, { tenant, billingUsageReporter, auditLogger });

    await manager.createApiKey({ name: 'orders-service' });
    await manager.revokeApiKey('key-id');
    await manager.importAddressPool({ protocol: 'evm', addresses: ['0x1', '0x2'] });
    await manager.testWebhook('webhook-id');

    expect(backend.createApiKey).toHaveBeenCalledWith({ name: 'orders-service', organizationId: 'tenant-1' });
    expect(backend.revokeApiKey).toHaveBeenCalledWith('key-id', 'tenant-1');
    expect(backend.importAddressPool).toHaveBeenCalledWith({ protocol: 'evm', addresses: ['0x1', '0x2'], organizationId: 'tenant-1' });
    expect(backend.testWebhook).toHaveBeenCalledWith('webhook-id', 'tenant-1');
    expect(billingUsageReporter.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ type: 'address_pool.imported', quantity: 2 }));
    expect(auditLogger.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'webhooks:test', subjectId: 'webhook-id' }));
  });
});
