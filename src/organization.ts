import type { CloudCapability } from './entitlements.js';

export const CloudOrganizationRoles = ['owner', 'admin', 'member', 'viewer'] as const;
export type CloudOrganizationRole = (typeof CloudOrganizationRoles)[number];

export const CloudOrganizationPlans = ['free', 'pro', 'enterprise'] as const;
export type CloudOrganizationPlan = (typeof CloudOrganizationPlans)[number];

export const CloudMembershipStatuses = ['pending', 'active', 'suspended'] as const;
export type CloudMembershipStatus = (typeof CloudMembershipStatuses)[number];

export interface CloudOrganization {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  website?: string;
  description?: string;
  planType: CloudOrganizationPlan;
  monthlyOrderLimit?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CloudOrganizationMember {
  id?: string;
  organizationId: string;
  userId: string;
  role: CloudOrganizationRole;
  status: CloudMembershipStatus;
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt?: Date;
  createdAt?: Date;
}

export interface CloudOrganizationWithRole {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  planType: CloudOrganizationPlan;
  role: CloudOrganizationRole;
  memberStatus: CloudMembershipStatus;
  createdAt?: Date;
}

export interface CloudMembershipVerificationResult {
  valid: boolean;
  role?: CloudOrganizationRole;
  status?: CloudMembershipStatus;
  error?: string;
}

export const CLOUD_ROLE_CAPABILITIES: Readonly<Record<CloudOrganizationRole, readonly CloudCapability[]>> = {
  owner: [
    'orders:create',
    'orders:read',
    'payment-links:create',
    'payment-links:update',
    'payment-links:read',
    'api-keys:create',
    'api-keys:read',
    'api-keys:revoke',
    'address-pool:import',
    'address-pool:read',
    'webhooks:test',
    'webhooks:read',
    'config:read',
    'config:update',
  ],
  admin: [
    'orders:create',
    'orders:read',
    'payment-links:create',
    'payment-links:update',
    'payment-links:read',
    'api-keys:create',
    'api-keys:read',
    'api-keys:revoke',
    'address-pool:import',
    'address-pool:read',
    'webhooks:test',
    'webhooks:read',
    'config:read',
    'config:update',
  ],
  member: [
    'orders:create',
    'orders:read',
    'payment-links:create',
    'payment-links:update',
    'payment-links:read',
    'address-pool:read',
    'webhooks:read',
    'config:read',
  ],
  viewer: [
    'orders:read',
    'payment-links:read',
    'address-pool:read',
    'webhooks:read',
    'config:read',
  ],
};

export function isCloudOrganizationRole(value: string): value is CloudOrganizationRole {
  return (CloudOrganizationRoles as readonly string[]).includes(value);
}

export function isCloudOrganizationPlan(value: string): value is CloudOrganizationPlan {
  return (CloudOrganizationPlans as readonly string[]).includes(value);
}

export function isCloudMembershipStatus(value: string): value is CloudMembershipStatus {
  return (CloudMembershipStatuses as readonly string[]).includes(value);
}

export function hasCloudRoleCapability(role: CloudOrganizationRole, capability: CloudCapability): boolean {
  return CLOUD_ROLE_CAPABILITIES[role].includes(capability);
}

export function verifyCloudMembership(
  member?: Pick<CloudOrganizationMember, 'role' | 'status'> | null
): CloudMembershipVerificationResult {
  if (!member) {
    return { valid: false, error: 'Not a member of this organization' };
  }

  if (member.status !== 'active') {
    return {
      valid: false,
      role: member.role,
      status: member.status,
      error: `Membership status is ${member.status}`,
    };
  }

  return { valid: true, role: member.role, status: member.status };
}
