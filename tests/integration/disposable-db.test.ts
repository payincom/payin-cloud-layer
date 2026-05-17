import { afterAll, describe, expect, it } from 'vitest';
import {
  PgSqlExecutor,
  SqlCloudAddressPoolRepository,
  SqlCloudApiKeyRepository,
  SqlCloudAuditTrail,
  SqlCloudNotificationDeliveryRepository,
  SqlCloudOrderRepository,
  SqlCloudOrganizationRepository,
  SqlCloudPaymentLinkRepository,
  SqlCloudSubscriptionRepository,
  SqlCloudTenantResolver,
  SqlCloudUsageMeter,
  SqlHostedConfigRepository,
  SqlCloudWebhookRepository,
  createCloudAuditEvent,
  createCloudWebhookDeliveryRecord,
  applyCloudLayerSchema,
  assertDisposableIntegrationDatabaseUrl,
  getCloudLayerMinimalSchemaSql,
  normalizeCloudOrder,
  shouldRunDisposableIntegration,
} from '../../src/index.js';

const enabled = shouldRunDisposableIntegration();
const databaseUrl = process.env.DATABASE_URL ?? process.env.DB_CONNECTION_STRING ?? '';
let executor: PgSqlExecutor | undefined;

afterAll(async () => {
  await executor?.close();
});

describe.runIf(enabled)('disposable database integration', () => {
  it('applies schema and exercises SQL tenant/order adapters against disposable PostgreSQL', async () => {
    assertDisposableIntegrationDatabaseUrl(databaseUrl);
    executor = new PgSqlExecutor({ connectionString: databaseUrl });

    await applyCloudLayerSchema(executor, getCloudLayerMinimalSchemaSql());

    await executor.query(
      `INSERT INTO organizations (id, name, slug, plan_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, plan_type = EXCLUDED.plan_type`,
      ['org-integration', 'Integration Org', 'integration-org', 'pro']
    );
    await executor.query(
      `INSERT INTO organization_members (organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status`,
      ['org-integration', 'user-integration', 'admin', 'active']
    );

    const organizations = new SqlCloudOrganizationRepository(executor);
    await expect(organizations.getByTenant({ organizationId: 'org-integration' })).resolves.toMatchObject({
      id: 'org-integration',
      name: 'Integration Org',
      planType: 'pro',
    });
    await expect(organizations.updateByTenant({ organizationId: 'org-integration' }, { name: 'Integration Org Updated' })).resolves.toMatchObject({
      id: 'org-integration',
      name: 'Integration Org Updated',
    });
    await expect(organizations.addMember({ organizationId: 'org-integration', userId: 'user-added', role: 'viewer', status: 'active', joinedAt: new Date('2026-05-17T00:30:00.000Z') })).resolves.toMatchObject({
      organizationId: 'org-integration',
      userId: 'user-added',
      role: 'viewer',
    });
    await expect(organizations.updateMember({ organizationId: 'org-integration' }, 'user-added', { role: 'member', status: 'active' })).resolves.toMatchObject({
      userId: 'user-added',
      role: 'member',
    });

    const configs = new SqlHostedConfigRepository(executor);
    await expect(configs.updateTenantConfig({ organizationId: 'org-integration' }, {
      apiBaseUrl: 'https://api.integration.example',
      enabledChains: ['ethereum-sepolia'],
      enabledTokens: ['USDC'],
      secretRefs: { webhookSigningSecretRef: 'secret://integration/hosted-config' },
      limits: { apiKeyLimit: 10 },
      metadata: { source: 'disposable-db' },
    })).resolves.toMatchObject({
      tenant: { organizationId: 'org-integration' },
      apiBaseUrl: 'https://api.integration.example',
      enabledChains: ['ethereum-sepolia'],
      enabledTokens: ['USDC'],
      limits: { apiKeyLimit: 10 },
    });
    await expect(configs.getTenantConfig({ organizationId: 'org-integration' })).resolves.toMatchObject({
      secretRefs: { webhookSigningSecretRef: 'secret://integration/hosted-config' },
      metadata: { source: 'disposable-db' },
    });

    const subscriptions = new SqlCloudSubscriptionRepository(executor);
    await expect(subscriptions.upsert({
      tenant: { organizationId: 'org-integration' },
      status: 'active',
      plan: 'pro',
      billingCustomerRef: 'stripe://cus_integration',
      currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
      limits: { monthlyOrderLimit: 1000, apiKeyLimit: 10 },
      metadata: { source: 'disposable-db' },
    })).resolves.toMatchObject({
      tenant: { organizationId: 'org-integration' },
      status: 'active',
      plan: 'pro',
      billingCustomerRef: 'stripe://cus_integration',
      limits: { monthlyOrderLimit: 1000, apiKeyLimit: 10 },
    });
    await expect(subscriptions.getForTenant({ organizationId: 'org-integration' })).resolves.toMatchObject({
      status: 'active',
      plan: 'pro',
      metadata: { source: 'disposable-db' },
    });

    const apiKeys = new SqlCloudApiKeyRepository(executor);
    await apiKeys.create({
      presentedKey: 'pk_live_integration_secret',
      tenant: { organizationId: 'org-integration' },
      apiKey: { id: 'key-integration', keyPrefix: 'pk_live_', name: 'Integration API key', organizationId: 'org-integration', userId: 'user-integration', role: 'admin', createdAt: new Date('2026-05-16T23:59:00.000Z') },
      membership: { role: 'admin', status: 'active' },
    });
    await expect(apiKeys.listForTenant({ organizationId: 'org-integration' })).resolves.toMatchObject([
      { id: 'key-integration', organizationId: 'org-integration', keyPrefix: 'pk_live_' },
    ]);
    await expect(apiKeys.findByPresentedKey('pk_live_integration_secret')).resolves.toMatchObject({
      apiKey: { id: 'key-integration', organizationId: 'org-integration' },
      tenant: { organizationId: 'org-integration' },
    });

    const resolver = new SqlCloudTenantResolver(executor);
    await expect(resolver.resolveForUser('user-integration', 'org-integration')).resolves.toMatchObject({
      userId: 'user-integration',
      tenant: { organizationId: 'org-integration', tenantId: 'org-integration', plan: 'pro' },
      role: 'admin',
      status: 'active',
    });

    const orders = new SqlCloudOrderRepository(executor);
    await orders.save(normalizeCloudOrder({
      id: 'order-integration',
      tenant: { organizationId: 'org-integration' },
      orderReference: 'ref-integration',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      status: 'pending',
      confirmedReceived: '0',
    }));

    await expect(orders.findByTenant('order-integration', { organizationId: 'org-integration' })).resolves.toMatchObject({
      id: 'order-integration',
      tenant: { organizationId: 'org-integration', tenantId: 'org-integration' },
      orderReference: 'ref-integration',
    });
    await expect(orders.findByTenant('order-integration', { organizationId: 'org-other' })).resolves.toBeNull();

    const paymentLinks = new SqlCloudPaymentLinkRepository(executor);
    await paymentLinks.save({
      id: 'plink-integration',
      tenant: { organizationId: 'org-integration' },
      title: 'Integration checkout',
      amount: '25.50',
      currency: 'USDC',
      chainOptions: ['ethereum-sepolia'],
      status: 'draft',
      inventoryReserved: 0,
    });
    await expect(paymentLinks.findByTenant('plink-integration', { organizationId: 'org-integration' })).resolves.toMatchObject({
      id: 'plink-integration',
      tenant: { organizationId: 'org-integration' },
    });

    const addressPool = new SqlCloudAddressPoolRepository(executor);
    await addressPool.import([{ tenant: { organizationId: 'org-integration' }, address: '0x1111111111111111111111111111111111111111', protocol: 'evm', state: 'idle' }]);
    await expect(addressPool.listByTenant({ organizationId: 'org-integration' })).resolves.toMatchObject([
      { address: '0x1111111111111111111111111111111111111111', tenant: { organizationId: 'org-integration' } },
    ]);

    const webhooks = new SqlCloudWebhookRepository(executor);
    await webhooks.upsert({
      id: 'wh-integration',
      tenant: { organizationId: 'org-integration' },
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://integration/webhook',
      enabled: true,
    });
    await expect(webhooks.getForTenant('wh-integration', { organizationId: 'org-integration' })).resolves.toMatchObject({
      id: 'wh-integration',
      tenant: { organizationId: 'org-integration' },
    });

    const usage = new SqlCloudUsageMeter(executor);
    await usage.recordUsage({ tenant: { organizationId: 'org-integration' }, type: 'order.created', subjectId: 'order-integration', quantity: 1, occurredAt: new Date('2026-05-16T22:55:00.000Z') });
    await expect(usage.listUsage({ tenantId: 'org-integration', type: 'order.created' })).resolves.toMatchObject([
      { tenant: { organizationId: 'org-integration' }, type: 'order.created', subjectId: 'order-integration' },
    ]);

    const deliveries = new SqlCloudNotificationDeliveryRepository(executor);
    await deliveries.enqueue(createCloudWebhookDeliveryRecord({
      id: 'delivery-integration',
      tenant: { organizationId: 'org-integration' },
      endpointId: 'wh-integration',
      eventId: 'evt-integration',
      eventType: 'order.completed',
      url: 'https://merchant.example/webhook',
      headers: { 'payin-signature': 'sig-integration' },
      body: '{}',
      nextAttemptAt: new Date('2026-05-17T01:50:00.000Z'),
    }));
    await expect(deliveries.listForTenant({ organizationId: 'org-integration' })).resolves.toMatchObject([
      { id: 'delivery-integration', status: 'queued', endpointId: 'wh-integration' },
    ]);
    await expect(deliveries.claimDue({ now: new Date('2026-05-17T01:51:00.000Z'), limit: 10 })).resolves.toMatchObject([
      { id: 'delivery-integration', status: 'processing' },
    ]);

    const audit = new SqlCloudAuditTrail(executor);
    await audit.record(createCloudAuditEvent({ tenant: { organizationId: 'org-integration' }, action: 'orders:create', actor: { type: 'api_key', id: 'key-integration' }, subjectId: 'order-integration' }));

    await expect(apiKeys.revokeForTenant('key-integration', { organizationId: 'org-integration' }, new Date('2026-05-17T00:00:00.000Z'))).resolves.toMatchObject({
      id: 'key-integration',
      revokedAt: new Date('2026-05-17T00:00:00.000Z'),
    });
  });
});

describe.skipIf(enabled)('disposable database integration disabled', () => {
  it('documents the opt-in gate', () => {
    expect(shouldRunDisposableIntegration()).toBe(false);
    expect(process.env.PAYIN_CLOUD_LAYER_INTEGRATION).not.toBe('1');
  });
});
