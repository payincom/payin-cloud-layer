import { afterAll, describe, expect, it } from 'vitest';
import {
  PgSqlExecutor,
  SqlCloudOrderRepository,
  SqlCloudTenantResolver,
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
  });
});

describe.skipIf(enabled)('disposable database integration disabled', () => {
  it('documents the opt-in gate', () => {
    expect(shouldRunDisposableIntegration()).toBe(false);
    expect(process.env.PAYIN_CLOUD_LAYER_INTEGRATION).not.toBe('1');
  });
});
