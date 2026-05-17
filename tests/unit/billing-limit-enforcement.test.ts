import { describe, expect, it } from 'vitest';
import {
  InMemoryCloudSubscriptionRepository,
  InMemoryUsageMeter,
  SubscriptionBillingLimitEnforcer,
} from '../../src/index.js';

const tenant = { organizationId: 'org-billing-limit', tenantId: 'org-billing-limit', plan: 'pro' as const };

describe('subscription billing limit enforcement', () => {
  it('allows usage under the active subscription period limit', async () => {
    const subscriptions = new InMemoryCloudSubscriptionRepository([
      { tenant, status: 'active', plan: 'pro', currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'), currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'), limits: { monthlyOrderLimit: 2 } },
    ]);
    const usage = new InMemoryUsageMeter();
    usage.recordUsage({ tenant, type: 'order.created', subjectId: 'order-1', occurredAt: new Date('2026-05-15T00:00:00.000Z') });
    const enforcer = new SubscriptionBillingLimitEnforcer({ subscriptions, usage });

    await expect(enforcer.assertCanConsume({ tenant, limitName: 'monthlyOrderLimit', usageType: 'order.created', requested: 1, at: new Date('2026-05-17T00:00:00.000Z') })).resolves.toMatchObject({
      allowed: true,
      current: 1,
      requested: 1,
      limit: 2,
    });
  });

  it('denies usage over the active subscription period limit', async () => {
    const subscriptions = new InMemoryCloudSubscriptionRepository([
      { tenant, status: 'active', plan: 'pro', currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'), currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'), limits: { monthlyOrderLimit: 1 } },
    ]);
    const usage = new InMemoryUsageMeter();
    usage.recordUsage({ tenant, type: 'order.created', subjectId: 'order-1', occurredAt: new Date('2026-05-15T00:00:00.000Z') });
    const enforcer = new SubscriptionBillingLimitEnforcer({ subscriptions, usage });

    await expect(enforcer.assertCanConsume({ tenant, limitName: 'monthlyOrderLimit', usageType: 'order.created', requested: 1, at: new Date('2026-05-17T00:00:00.000Z'), throwOnDeny: true })).rejects.toThrow('Subscription usage limit exceeded: monthlyOrderLimit');
  });

  it('requires an active or trialing subscription for write usage', async () => {
    const subscriptions = new InMemoryCloudSubscriptionRepository([{ tenant, status: 'past_due', plan: 'pro' }]);
    const enforcer = new SubscriptionBillingLimitEnforcer({ subscriptions, usage: new InMemoryUsageMeter() });

    await expect(enforcer.assertCanConsume({ tenant, limitName: 'monthlyOrderLimit', usageType: 'order.created' })).rejects.toThrow('Cloud subscription is not active: past_due');
  });
});
