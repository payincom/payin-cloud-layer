import { describe, expect, it } from 'vitest';
import {
  CloudApiKeyAuthenticator,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudTenantResolver,
  InMemoryCloudWebhookEndpointRepository,
  InMemoryUsageMeter,
  StaticHostedConfigProvider,
  createCloudAuditEvent,
  createCloudLayerPorts,
  createCloudOrderDraft,
  createRuntimeReadinessReport,
  normalizeCloudOrder,
  type CloudLayerPorts,
} from '../../src/index.js';

const tenant = { organizationId: 'org-flow', tenantId: 'org-flow', plan: 'pro' as const };

function makePorts(): CloudLayerPorts {
  const orders: unknown[] = [];
  const usageMeter = new InMemoryUsageMeter();
  const auditTrail = new InMemoryCloudAuditTrail();

  return createCloudLayerPorts({
    tenantResolver: new InMemoryCloudTenantResolver([{ userId: 'user-1', tenant, role: 'admin', status: 'active' }]),
    apiKeys: new InMemoryCloudApiKeyRepository([
      {
        presentedKey: 'pk_live_flow',
        apiKey: { id: 'key-flow', keyPrefix: 'pk_live_', name: 'Flow key', organizationId: 'org-flow', userId: 'user-1', role: 'admin' },
        membership: { role: 'admin', status: 'active' },
        tenant,
      },
    ]),
    hostedConfig: new StaticHostedConfigProvider({ enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'] }),
    orders: {
      create: async (request) => {
        const order = normalizeCloudOrder({ id: 'order-flow-1', paymentAddress: '0x1111111111111111111111111111111111111111', ...(request as object) } as never);
        orders.push(order);
        return order;
      },
      get: async (orderId) => orders.find((order) => (order as { id: string }).id === orderId) ?? null,
      list: async () => orders,
    },
    paymentLinks: { create: async (request) => request, get: async () => null, list: async () => [], update: async () => null },
    addressPool: { import: async (request) => request, summary: async () => null },
    webhooks: new InMemoryCloudWebhookEndpointRepository([]),
    auditTrail,
    usageMeter,
  });
}

describe('Cloud application order flow contract', () => {
  it('runs authenticated order creation with config, usage, audit, and readiness checks through ports', async () => {
    const ports = makePorts();
    const authenticator = new CloudApiKeyAuthenticator(ports.apiKeys);
    const scope = await authenticator.authenticate('pk_live_flow', new Date('2026-05-16T14:20:00.000Z'));
    await authenticator.assertCapability(scope, 'orders:create');

    const config = await ports.hostedConfig.getTenantConfig(scope.tenant);
    expect(config.isChainEnabled('ethereum-sepolia')).toBe(true);
    expect(config.isTokenEnabled('USDC')).toBe(true);

    const draft = createCloudOrderDraft({
      tenant: scope.tenant,
      orderReference: 'merchant-flow-1',
      amount: '12.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
    });
    const created = await ports.orders.create(draft) as { id: string; tenant: typeof tenant };

    await ports.usageMeter.recordUsage({ tenant: scope.tenant, type: 'order.created', subjectId: created.id, quantity: 1, occurredAt: new Date('2026-05-16T14:21:00.000Z') });
    await ports.auditTrail.record(createCloudAuditEvent({ tenant: scope.tenant, action: 'orders:create', actor: { type: 'api_key', id: scope.apiKeyId }, subjectId: created.id }));

    expect(await ports.orders.get('order-flow-1', scope.tenant)).toMatchObject({ id: 'order-flow-1', tenant });
    expect(await ports.usageMeter.listUsage({ tenantId: 'org-flow' })).toMatchObject([{ type: 'order.created', subjectId: 'order-flow-1' }]);
    expect(await ports.auditTrail.list({ tenantId: 'org-flow', action: 'orders:create' })).toMatchObject([{ subjectId: 'order-flow-1' }]);

    const readiness = createRuntimeReadinessReport({
      tenant: scope.tenant,
      checks: [
        { name: 'config.chain.ethereum-sepolia', status: config.isChainEnabled('ethereum-sepolia') ? 'pass' : 'fail' },
        { name: 'config.token.USDC', status: config.isTokenEnabled('USDC') ? 'pass' : 'fail' },
      ],
    });
    expect(readiness.status).toBe('pass');
  });
});
