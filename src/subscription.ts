import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';
import { EntitlementDeniedError, type CloudCapability, type EntitlementProvider } from './entitlements.js';
import type { CloudOrganizationPlan } from './organization.js';
import { DEFAULT_HOSTED_PLAN_LIMITS, type HostedLimitDecision, type HostedRuntimeLimits } from './hosted-config.js';

export type CloudSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled';

export interface CloudSubscriptionInput {
  tenant: CloudTenantContext;
  status: CloudSubscriptionStatus;
  plan: CloudOrganizationPlan;
  billingCustomerRef?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  limits?: HostedRuntimeLimits;
  metadata?: Record<string, unknown>;
}

export interface CloudSubscription extends Omit<CloudSubscriptionInput, 'tenant' | 'limits'> {
  tenant: NormalizedCloudTenantContext;
  limits: HostedRuntimeLimits;
}

export interface CloudSubscriptionRepository {
  getForTenant(tenant: CloudTenantContext): Promise<CloudSubscription | null> | CloudSubscription | null;
}

export interface CloudSubscriptionManagementRepository extends CloudSubscriptionRepository {
  upsert(subscription: CloudSubscriptionInput): Promise<CloudSubscription> | CloudSubscription;
}

export class CloudSubscriptionError extends Error {
  readonly code = 'CLOUD_SUBSCRIPTION_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'CloudSubscriptionError';
  }
}

export class SubscriptionUsageLimitExceededError extends Error {
  readonly code = 'SUBSCRIPTION_USAGE_LIMIT_EXCEEDED';

  constructor(readonly decision: HostedLimitDecision) {
    super(decision.message ?? `Subscription usage limit exceeded: ${String(decision.limitName)}`);
    this.name = 'SubscriptionUsageLimitExceededError';
  }
}

const READ_ONLY_CAPABILITIES: ReadonlySet<CloudCapability> = new Set(['orders:read', 'payment-links:read', 'api-keys:read', 'address-pool:read', 'webhooks:read', 'config:read']);

export function normalizeCloudSubscription(input: CloudSubscriptionInput): CloudSubscription {
  const tenant = normalizeCloudTenantContext(input.tenant);
  return {
    ...input,
    tenant,
    limits: { ...DEFAULT_HOSTED_PLAN_LIMITS[input.plan], ...(input.limits ?? {}) },
  };
}

export function isSubscriptionActive(subscription: Pick<CloudSubscription, 'status'>): boolean {
  return subscription.status === 'active' || subscription.status === 'trialing';
}

export class InMemoryCloudSubscriptionRepository implements CloudSubscriptionManagementRepository {
  private readonly records = new Map<string, CloudSubscription>();

  constructor(records: CloudSubscriptionInput[] = []) {
    for (const record of records) {
      const normalized = normalizeCloudSubscription(record);
      this.records.set(normalized.tenant.organizationId, normalized);
    }
  }

  getForTenant(tenant: CloudTenantContext): CloudSubscription | null {
    const normalized = normalizeCloudTenantContext(tenant);
    return this.records.get(normalized.organizationId) ?? null;
  }

  upsert(subscription: CloudSubscriptionInput): CloudSubscription {
    const normalized = normalizeCloudSubscription(subscription);
    this.records.set(normalized.tenant.organizationId, normalized);
    return normalized;
  }
}

export class SubscriptionEntitlementProvider implements EntitlementProvider {
  constructor(private readonly subscriptions: CloudSubscriptionRepository) {}

  async assertAllowed(context: CloudTenantContext, capability: CloudCapability): Promise<void> {
    const subscription = await this.subscriptions.getForTenant(context);
    if (!subscription) throw new EntitlementDeniedError(context, capability, 'Cloud subscription is required');
    if (!isSubscriptionActive(subscription) && !READ_ONLY_CAPABILITIES.has(capability)) {
      throw new EntitlementDeniedError(context, capability, `Cloud subscription is not active: ${subscription.status}`);
    }
  }
}

export function assertSubscriptionUsageLimit(input: {
  limitName: keyof HostedRuntimeLimits;
  limits: HostedRuntimeLimits;
  current: number;
  requested?: number;
  throwOnDeny?: boolean;
}): HostedLimitDecision {
  const requested = input.requested ?? 1;
  const limit = input.limits[input.limitName];
  const allowed = limit == null || input.current + requested <= limit;
  const decision: HostedLimitDecision = allowed
    ? { allowed, limitName: input.limitName, limit, current: input.current, requested }
    : {
        allowed,
        limitName: input.limitName,
        limit,
        current: input.current,
        requested,
        code: 'HOSTED_LIMIT_EXCEEDED',
        message: `Subscription usage limit exceeded: ${String(input.limitName)}`,
      };
  if (!allowed && input.throwOnDeny) throw new SubscriptionUsageLimitExceededError(decision);
  return decision;
}
