import { describe, expect, it } from 'vitest';
import {
  InMemoryCloudSubscriptionRepository,
  SubscriptionEntitlementProvider,
  assertSubscriptionUsageLimit,
  normalizeCloudSubscription,
} from '../../src/index.js';

const tenant = { organizationId: 'org-subscription', tenantId: 'org-subscription', plan: 'pro' as const };

describe('subscription enforcement', () => {
  it('normalizes active hosted subscription state', () => {
    expect(normalizeCloudSubscription({ tenant, status: 'active', plan: 'pro', limits: { monthlyOrderLimit: 1000 } })).toMatchObject({
      tenant,
      status: 'active',
      plan: 'pro',
      limits: { monthlyOrderLimit: 1000 },
    });
  });

  it('denies capabilities for inactive subscriptions', async () => {
    const repo = new InMemoryCloudSubscriptionRepository([
      { tenant, status: 'past_due', plan: 'pro', limits: { monthlyOrderLimit: 1000 } },
    ]);
    const entitlements = new SubscriptionEntitlementProvider(repo);

    await expect(entitlements.assertAllowed(tenant, 'orders:create')).rejects.toThrow('Cloud subscription is not active: past_due');
    await expect(entitlements.assertAllowed(tenant, 'config:read')).resolves.toBeUndefined();
  });

  it('allows active subscriptions to use Cloud capabilities', async () => {
    const repo = new InMemoryCloudSubscriptionRepository([{ tenant, status: 'active', plan: 'pro' }]);
    const entitlements = new SubscriptionEntitlementProvider(repo);

    await expect(entitlements.assertAllowed(tenant, 'orders:create')).resolves.toBeUndefined();
  });

  it('enforces usage limits from subscription plan', () => {
    expect(assertSubscriptionUsageLimit({ limitName: 'monthlyOrderLimit', current: 99, requested: 1, limits: { monthlyOrderLimit: 100 } })).toMatchObject({ allowed: true });
    expect(() => assertSubscriptionUsageLimit({ limitName: 'monthlyOrderLimit', current: 100, requested: 1, limits: { monthlyOrderLimit: 100 }, throwOnDeny: true })).toThrow('Subscription usage limit exceeded: monthlyOrderLimit');
  });
});
