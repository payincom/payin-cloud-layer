import { describe, expect, it } from 'vitest';
import {
  CloudApiKeyAuthenticator,
  CloudOrderService,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudSubscriptionRepository,
  InMemoryCloudOrderRepository,
  InMemoryUsageMeter,
  RepositoryBackedOrderPort,
  StaticEntitlementProvider,
  StaticHostedConfigProvider,
  SubscriptionBillingLimitEnforcer,
  type CloudLayerPorts,
} from '../../src/index.js';

const tenant = { organizationId: 'org-service', tenantId: 'org-service', plan: 'pro' as const };

function service(overrides: Partial<ConstructorParameters<typeof CloudOrderService>[0]> = {}) {
  const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
  const auditTrail = new InMemoryCloudAuditTrail();
  const apiKeys = new InMemoryCloudApiKeyRepository([
    {
      presentedKey: 'pk_live_orders',
      apiKey: { id: 'key-1', keyPrefix: 'pk_live_', name: 'Orders', organizationId: 'org-service', userId: 'user-1', role: 'admin' },
      membership: { role: 'admin', status: 'active' },
      tenant,
    },
  ]);
  const orders = new RepositoryBackedOrderPort(new InMemoryCloudOrderRepository());
  return {
    usageMeter,
    auditTrail,
    orders,
    service: new CloudOrderService({
      authenticator: new CloudApiKeyAuthenticator(apiKeys),
      entitlementProvider: new StaticEntitlementProvider(['orders:create', 'orders:read']),
      hostedConfig: new StaticHostedConfigProvider({ enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'] }),
      orders,
      usageMeter,
      auditTrail,
      ...overrides,
    }),
  };
}

describe('CloudOrderService', () => {
  it('creates orders through auth, entitlement, hosted config, adapter, usage, and audit', async () => {
    const setup = service();

    const order = await setup.service.createOrder({
      apiKey: 'pk_live_orders',
      orderReference: 'merchant-service-1',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      now: new Date('2026-05-16T23:10:00.000Z'),
    });

    expect(order).toMatchObject({
      tenant,
      orderReference: 'merchant-service-1',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      status: 'pending',
    });
    expect(await setup.usageMeter.listUsage({ tenantId: 'org-service' })).toMatchObject([
      { type: 'order.created', subjectId: order.id, quantity: 1 },
    ]);
    expect(await setup.auditTrail.list({ tenantId: 'org-service', action: 'orders:create' })).toMatchObject([
      { action: 'orders:create', actor: { type: 'api_key', id: 'key-1' }, subjectId: order.id },
    ]);
  });

  it('rejects disabled chains before adapter side effects', async () => {
    const setup = service({ hostedConfig: new StaticHostedConfigProvider({ enabledChains: ['base-sepolia'], enabledTokens: ['USDC'] }) });

    await expect(setup.service.createOrder({
      apiKey: 'pk_live_orders',
      orderReference: 'merchant-service-2',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
    })).rejects.toThrow('Chain ethereum-sepolia is not enabled for this tenant');

    await expect(setup.orders.list(tenant)).resolves.toHaveLength(0);
  });

  it('rejects missing entitlement before adapter side effects', async () => {
    const setup = service({ entitlementProvider: new StaticEntitlementProvider(['orders:read']) });

    await expect(setup.service.createOrder({
      apiKey: 'pk_live_orders',
      orderReference: 'merchant-service-3',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
    })).rejects.toThrow('Tenant is not entitled to capability: orders:create');

    await expect(setup.orders.list(tenant)).resolves.toHaveLength(0);
  });

  it('reads and lists tenant-scoped orders through read entitlement', async () => {
    const setup = service();
    const order = await setup.service.createOrder({ apiKey: 'pk_live_orders', orderReference: 'merchant-service-read', amount: '10.00', currency: 'USDC', chainId: 'ethereum-sepolia' });

    await expect(setup.service.getOrder({ apiKey: 'pk_live_orders', orderId: order.id })).resolves.toMatchObject({ id: order.id, tenant });
    await expect(setup.service.listOrders({ apiKey: 'pk_live_orders', status: 'pending' })).resolves.toMatchObject([{ id: order.id, status: 'pending' }]);
  });

  it('rejects missing read entitlement before returning orders', async () => {
    const setup = service({ entitlementProvider: new StaticEntitlementProvider(['orders:create']) });
    const order = await setup.service.createOrder({ apiKey: 'pk_live_orders', orderReference: 'merchant-service-read-denied', amount: '10.00', currency: 'USDC', chainId: 'ethereum-sepolia' });

    await expect(setup.service.getOrder({ apiKey: 'pk_live_orders', orderId: order.id })).rejects.toThrow('Tenant is not entitled to capability: orders:read');
  });

  it('enforces subscription order limits before adapter side effects', async () => {
    const setup = service();
    const subscriptions = new InMemoryCloudSubscriptionRepository([
      { tenant, status: 'active', plan: 'pro', limits: { monthlyOrderLimit: 1 } },
    ]);
    await setup.usageMeter.recordUsage({ tenant, type: 'order.created', subjectId: 'existing-order', occurredAt: new Date('2026-05-16T00:00:00.000Z') });
    const limited = service({ billingLimitEnforcer: new SubscriptionBillingLimitEnforcer({ subscriptions, usage: setup.usageMeter }) });

    await expect(limited.service.createOrder({
      apiKey: 'pk_live_orders',
      orderReference: 'merchant-service-limited',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      now: new Date('2026-05-17T00:00:00.000Z'),
    })).rejects.toThrow('Subscription usage limit exceeded: monthlyOrderLimit');

    await expect(limited.orders.list(tenant)).resolves.toHaveLength(0);
  });
});
