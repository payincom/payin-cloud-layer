import { describe, expect, it } from 'vitest';
import {
  CLOUD_ROLE_CAPABILITIES,
  CloudMembershipStatuses,
  CloudOrganizationPlans,
  CloudOrganizationRoles,
  hasCloudRoleCapability,
  isCloudMembershipStatus,
  isCloudOrganizationPlan,
  isCloudOrganizationRole,
  normalizeCloudTenantContext,
  StaticHostedConfigProvider,
  verifyCloudMembership,
} from '../../src/index.js';

describe('Cloud organization business contracts', () => {
  it('matches the existing PayIn Cloud organization vocabulary', () => {
    expect(CloudOrganizationRoles).toEqual(['owner', 'admin', 'member', 'viewer']);
    expect(CloudOrganizationPlans).toEqual(['free', 'pro', 'enterprise']);
    expect(CloudMembershipStatuses).toEqual(['pending', 'active', 'suspended']);

    expect(isCloudOrganizationRole('owner')).toBe(true);
    expect(isCloudOrganizationRole('superuser')).toBe(false);
    expect(isCloudOrganizationPlan('enterprise')).toBe(true);
    expect(isCloudOrganizationPlan('custom')).toBe(false);
    expect(isCloudMembershipStatus('active')).toBe(true);
    expect(isCloudMembershipStatus('disabled')).toBe(false);
  });

  it('keeps role permissions explicit at the Cloud overlay boundary', () => {
    expect(hasCloudRoleCapability('owner', 'api-keys:revoke')).toBe(true);
    expect(hasCloudRoleCapability('admin', 'config:update')).toBe(true);
    expect(hasCloudRoleCapability('member', 'orders:create')).toBe(true);
    expect(hasCloudRoleCapability('member', 'api-keys:create')).toBe(false);
    expect(hasCloudRoleCapability('viewer', 'orders:read')).toBe(true);
    expect(hasCloudRoleCapability('viewer', 'orders:create')).toBe(false);

    expect(CLOUD_ROLE_CAPABILITIES.viewer).not.toContain('config:update');
  });

  it('mirrors active membership verification semantics from the old Cloud auth package', () => {
    expect(verifyCloudMembership(null)).toEqual({
      valid: false,
      error: 'Not a member of this organization',
    });

    expect(verifyCloudMembership({ role: 'admin', status: 'pending' })).toEqual({
      valid: false,
      role: 'admin',
      status: 'pending',
      error: 'Membership status is pending',
    });

    expect(verifyCloudMembership({ role: 'owner', status: 'active' })).toEqual({
      valid: true,
      role: 'owner',
      status: 'active',
    });
  });

  it('maps organization plan and monthly limit into tenant context and hosted config', async () => {
    const tenant = normalizeCloudTenantContext({
      organizationId: 'org-pro',
      plan: 'pro',
      metadata: { monthlyOrderLimit: 5000 },
    });
    const provider = new StaticHostedConfigProvider({
      limits: { monthlyOrderLimit: 5000 },
      enabledChains: ['ethereum-sepolia'],
    });

    expect(tenant).toMatchObject({ organizationId: 'org-pro', tenantId: 'org-pro', plan: 'pro' });
    expect(await provider.getTenantConfig(tenant)).toEqual({
      tenant,
      limits: { monthlyOrderLimit: 5000 },
      enabledChains: ['ethereum-sepolia'],
    });
  });
});
