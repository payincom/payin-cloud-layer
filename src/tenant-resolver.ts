import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';

export type CloudTenantRole = 'owner' | 'admin' | 'member' | 'viewer' | string;
export type CloudTenantMembershipStatus = 'active' | 'pending' | 'suspended' | string;

export interface CloudTenantMembership {
  userId: string;
  tenant: CloudTenantContext;
  role: CloudTenantRole;
  status: CloudTenantMembershipStatus;
}

export interface CloudTenantResolver {
  resolveForUser(userId: string, organizationId: string): Promise<CloudTenantMembership | null> | CloudTenantMembership | null;
}

export class CloudTenantAccessError extends Error {
  readonly code = 'CLOUD_TENANT_ACCESS_DENIED';

  constructor(message = 'User is not an active member of the requested Cloud tenant') {
    super(message);
    this.name = 'CloudTenantAccessError';
  }
}

/**
 * Resolve and verify hosted tenant context for Cloud API routes.
 *
 * This mirrors the current PayIn Cloud repo's organization membership model, but
 * keeps it behind an adapter interface so the Cloud layer does not inherit API
 * route/database coupling directly.
 */
export async function resolveActiveCloudTenant(
  resolver: CloudTenantResolver,
  userId: string,
  organizationId: string
): Promise<NormalizedCloudTenantContext> {
  const membership = await resolver.resolveForUser(userId, organizationId);
  if (!membership || membership.status !== 'active') {
    throw new CloudTenantAccessError();
  }
  return normalizeCloudTenantContext(membership.tenant);
}

export class InMemoryCloudTenantResolver implements CloudTenantResolver {
  constructor(private readonly memberships: CloudTenantMembership[]) {}

  resolveForUser(userId: string, organizationId: string): CloudTenantMembership | null {
    return this.memberships.find((membership) =>
      membership.userId === userId && membership.tenant.organizationId === organizationId
    ) ?? null;
  }
}
