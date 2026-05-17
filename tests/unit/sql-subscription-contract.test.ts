import { describe, expect, it } from 'vitest';
import { SqlCloudSubscriptionRepository, SqlQueryRecorder } from '../../src/index.js';

const tenant = { organizationId: 'org-sql-subscription', tenantId: 'org-sql-subscription', plan: 'pro' as const };

describe('SQL subscription repository contracts', () => {
  it('loads tenant subscription from SQL row', async () => {
    const db = new SqlQueryRecorder([
      {
        organization_id: tenant.organizationId,
        status: 'active',
        plan: 'pro',
        billing_customer_ref: 'stripe://cus_123',
        current_period_start: new Date('2026-05-01T00:00:00.000Z'),
        current_period_end: new Date('2026-06-01T00:00:00.000Z'),
        limits: { monthlyOrderLimit: 1000 },
        metadata: { tier: 'launch' },
      },
    ]);
    const repo = new SqlCloudSubscriptionRepository(db);

    await expect(repo.getForTenant(tenant)).resolves.toMatchObject({
      tenant: { organizationId: tenant.organizationId, tenantId: tenant.tenantId },
      status: 'active',
      plan: 'pro',
      billingCustomerRef: 'stripe://cus_123',
      limits: { monthlyOrderLimit: 1000 },
      metadata: { tier: 'launch' },
    });
    expect(db.queries[0]).toEqual({
      text: 'SELECT * FROM subscriptions WHERE organization_id = $1 LIMIT 1',
      values: [tenant.organizationId],
    });
  });

  it('upserts tenant subscription state', async () => {
    const db = new SqlQueryRecorder([
      { organization_id: tenant.organizationId, status: 'active', plan: 'pro', limits: { apiKeyLimit: 10 } },
    ]);
    const repo = new SqlCloudSubscriptionRepository(db);

    await expect(repo.upsert({ tenant, status: 'active', plan: 'pro', limits: { apiKeyLimit: 10 } })).resolves.toMatchObject({
      tenant: { organizationId: tenant.organizationId, tenantId: tenant.tenantId },
      status: 'active',
      plan: 'pro',
      limits: { apiKeyLimit: 10 },
    });
    expect(db.queries[0]).toEqual({
      text: 'INSERT INTO subscriptions (organization_id, status, plan, billing_customer_ref, current_period_start, current_period_end, limits, metadata, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (organization_id) DO UPDATE SET status = EXCLUDED.status, plan = EXCLUDED.plan, billing_customer_ref = EXCLUDED.billing_customer_ref, current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end, limits = EXCLUDED.limits, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at RETURNING *',
      values: [tenant.organizationId, 'active', 'pro', undefined, undefined, undefined, { apiKeyLimit: 10 }, undefined, expect.any(Date)],
    });
  });
});
