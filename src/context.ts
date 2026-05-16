export type CloudPlan = 'free' | 'pro' | 'enterprise' | string;
export type CloudEnvironment = 'production' | 'sandbox' | 'development' | string;

/**
 * Explicit hosted Cloud tenant context.
 *
 * Cloud is deliberately tenant-explicit. Open hides tenant context behind its
 * single-merchant facade; Cloud must pass tenant/account context at every
 * overlay boundary before delegating into shared payment core APIs.
 */
export interface CloudTenantContext {
  /** Hosted tenant identifier. Defaults to organizationId for current schema compatibility. */
  tenantId?: string;
  /** Compatibility scope used by current PayIn storage/API contracts. */
  organizationId: string;
  /** PayIn Cloud account/customer id when different from organization id. */
  accountId?: string;
  /** Human-readable tenant label for audit/support surfaces. */
  label?: string;
  /** Commercial plan. Entitlement providers may use this for policy decisions. */
  plan?: CloudPlan;
  /** Runtime environment for audit/risk controls. */
  environment?: CloudEnvironment;
  /** Arbitrary Cloud metadata. Must not contain secrets. */
  metadata?: Record<string, unknown>;
}

export interface NormalizedCloudTenantContext extends CloudTenantContext {
  tenantId: string;
  organizationId: string;
}

export class CloudTenantContextError extends Error {
  readonly code = 'CLOUD_TENANT_CONTEXT_REQUIRED';

  constructor(message = 'Cloud tenant context with organizationId is required') {
    super(message);
    this.name = 'CloudTenantContextError';
  }
}

export function normalizeCloudTenantContext(context?: CloudTenantContext): NormalizedCloudTenantContext {
  const organizationId = context?.organizationId?.trim();
  if (!organizationId) {
    throw new CloudTenantContextError();
  }

  const tenantId = context?.tenantId?.trim() || organizationId;
  return {
    ...context,
    organizationId,
    tenantId,
  };
}
