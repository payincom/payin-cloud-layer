import { describe, expect, it } from 'vitest';
import { InMemoryUsageMeter, aggregateBillingPeriodUsage, toBillingPeriod } from '../../src/index.js';

const tenant = { organizationId: 'org-usage-aggregation' };

describe('billing-period usage aggregation', () => {
  it('aggregates usage from a usage meter for a tenant billing period', async () => {
    const meter = new InMemoryUsageMeter();
    meter.recordUsage({ tenant, type: 'order.created', subjectId: 'order-1', quantity: 1, occurredAt: new Date('2026-05-01T00:00:00.000Z') });
    meter.recordUsage({ tenant, type: 'order.created', subjectId: 'order-2', quantity: 2, occurredAt: new Date('2026-05-31T23:59:59.000Z') });
    meter.recordUsage({ tenant, type: 'api_key.created', subjectId: 'key-1', quantity: 1, occurredAt: new Date('2026-05-15T00:00:00.000Z') });
    meter.recordUsage({ tenant, type: 'order.created', subjectId: 'order-june', quantity: 10, occurredAt: new Date('2026-06-01T00:00:00.000Z') });

    await expect(aggregateBillingPeriodUsage(meter, { tenantId: tenant.organizationId, period: '2026-05' })).resolves.toEqual({
      tenantId: tenant.organizationId,
      period: '2026-05',
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-06-01T00:00:00.000Z'),
      totals: { 'order.created': 3, 'api_key.created': 1 },
    });
  });

  it('supports period derivation from date', () => {
    expect(toBillingPeriod(new Date('2026-05-17T02:45:00.000Z'))).toBe('2026-05');
  });
});
