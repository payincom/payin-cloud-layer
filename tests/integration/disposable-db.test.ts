import { afterAll, describe, expect, it } from 'vitest';
import {
  PgSqlExecutor,
  SqlCloudAddressPoolRepository,
  SqlCloudAuditTrail,
  SqlCloudOrderRepository,
  SqlCloudPaymentLinkRepository,
  SqlCloudTenantResolver,
  SqlCloudUsageMeter,
  SqlCloudWebhookRepository,
  createCloudAuditEvent,
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

    const audit = new SqlCloudAuditTrail(executor);
    await audit.record(createCloudAuditEvent({ tenant: { organizationId: 'org-integration' }, action: 'orders:create', actor: { type: 'api_key', id: 'key-integration' }, subjectId: 'order-integration' }));
  });
});

describe.skipIf(enabled)('disposable database integration disabled', () => {
  it('documents the opt-in gate', () => {
    expect(shouldRunDisposableIntegration()).toBe(false);
    expect(process.env.PAYIN_CLOUD_LAYER_INTEGRATION).not.toBe('1');
  });
});
