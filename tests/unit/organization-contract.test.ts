import { describe, expect, it } from 'vitest';
import {
  CLOUD_ORGANIZATION_PERMISSION_MATRIX,
  CLOUD_ROLE_CAPABILITIES,
  CloudMembershipStatuses,
  CloudOrganizationPlans,
  CloudOrganizationRoles,
  CloudOrganizationValidationError,
  assertActiveCloudMembership,
  assertCloudOrganizationPermission,
  createCloudMemberAddDraft,
  createCloudMemberInviteDraft,
  createCloudOrganizationDraft,
  createOwnershipTransferRoleUpdates,
  hasCloudOrganizationPermission,
  hasCloudRoleCapability,
  isCloudMembershipStatus,
  isCloudOrganizationPlan,
  isCloudOrganizationRole,
  normalizeCloudTenantContext,
  StaticHostedConfigProvider,
  updateCloudMemberDraft,
  updateCloudOrganizationDraft,
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
    expect(await provider.getTenantConfig(tenant)).toMatchObject({
      tenant,
      limits: { monthlyOrderLimit: 5000 },
      enabledChains: ['ethereum-sepolia'],
    });
  });

  it('validates create organization input and keeps slug uniqueness adapter-owned', () => {
    const draft = createCloudOrganizationDraft('user-owner', {
      name: '  Acme Commerce, Inc.  ',
      website: 'https://merchant.example',
      description: '  Merchant workspace  ',
      planType: 'pro',
      monthlyOrderLimit: 5000,
    });

    expect(draft.organization).toMatchObject({
      name: 'Acme Commerce, Inc.',
      slug: 'acme-commerce-inc',
      website: 'https://merchant.example',
      description: 'Merchant workspace',
      planType: 'pro',
      monthlyOrderLimit: 5000,
    });
    expect(draft.ownerMember).toMatchObject({
      userId: 'user-owner',
      role: 'owner',
      status: 'active',
    });
    expect(draft.slugUniqueness).toBe('adapter-owned');

    expect(() => createCloudOrganizationDraft('', { name: 'Acme' })).toThrow(CloudOrganizationValidationError);
    expect(() => createCloudOrganizationDraft('user-owner', { name: ' ' })).toThrow('Organization name is required');
    expect(() => createCloudOrganizationDraft('user-owner', { name: 'Acme', slug: 'Invalid Slug!' })).toThrow(
      'Organization slug must use lowercase letters, numbers, and hyphens'
    );
    expect(() => createCloudOrganizationDraft('user-owner', { name: 'Acme', monthlyOrderLimit: -1 })).toThrow(
      'monthlyOrderLimit must be a non-negative integer'
    );
  });

  it('validates update organization input without inventing adapter behavior', () => {
    expect(updateCloudOrganizationDraft({ name: ' New name ', slug: 'new-name', avatarUrl: null })).toEqual({
      name: 'New name',
      slug: 'new-name',
      avatarUrl: null,
    });

    expect(updateCloudOrganizationDraft({})).toEqual({});
    expect(() => updateCloudOrganizationDraft({ planType: 'custom' as never })).toThrow('Invalid organization plan');
    expect(() => updateCloudOrganizationDraft({ website: 'javascript:alert(1)' })).toThrow('website must be an http(s) URL');
  });

  it('defines owner/admin/member/viewer organization-management permissions', () => {
    expect(CLOUD_ORGANIZATION_PERMISSION_MATRIX.owner).toContain('ownership:transfer');
    expect(hasCloudOrganizationPermission('owner', 'organization:delete')).toBe(true);
    expect(hasCloudOrganizationPermission('admin', 'members:invite')).toBe(true);
    expect(hasCloudOrganizationPermission('admin', 'ownership:transfer')).toBe(false);
    expect(hasCloudOrganizationPermission('member', 'members:list')).toBe(true);
    expect(hasCloudOrganizationPermission('member', 'members:update')).toBe(false);
    expect(hasCloudOrganizationPermission('viewer', 'organization:read')).toBe(true);
    expect(hasCloudOrganizationPermission('viewer', 'orders:create')).toBe(false);
  });

  it('enforces active membership before role permission checks', () => {
    expect(() => assertActiveCloudMembership(null)).toThrow('Not a member of this organization');
    expect(() => assertActiveCloudMembership({ role: 'admin', status: 'pending' })).toThrow('Membership status is pending');

    expect(() =>
      assertCloudOrganizationPermission({ role: 'admin', status: 'active' }, 'members:invite')
    ).not.toThrow();
    expect(() => assertCloudOrganizationPermission({ role: 'viewer', status: 'active' }, 'members:invite')).toThrow(
      'Cloud organization permission members:invite requires a higher role'
    );
    expect(() => assertCloudOrganizationPermission({ role: 'owner', status: 'suspended' }, 'organization:delete')).toThrow(
      'Membership status is suspended'
    );
  });

  it('builds invite/add member drafts with explicit pending vs active semantics', () => {
    expect(
      createCloudMemberInviteDraft('org-1', 'admin-user', {
        email: ' New.Member@Example.COM ',
        role: 'viewer',
      })
    ).toMatchObject({
      organizationId: 'org-1',
      email: 'new.member@example.com',
      role: 'viewer',
      status: 'pending',
      invitedBy: 'admin-user',
    });

    expect(createCloudMemberAddDraft('org-1', 'user-2', 'member', 'admin-user')).toMatchObject({
      organizationId: 'org-1',
      userId: 'user-2',
      role: 'member',
      status: 'active',
      invitedBy: 'admin-user',
    });

    expect(() => createCloudMemberInviteDraft('org-1', 'admin-user', { email: 'bad', role: 'member' })).toThrow(
      'Invite email must be valid'
    );
    expect(() => createCloudMemberAddDraft('org-1', 'user-2', 'owner')).toThrow(
      'Members cannot be added directly as owner; use ownership transfer'
    );
  });

  it('validates member role/status updates and protects owner semantics', () => {
    const existing = { organizationId: 'org-1', userId: 'user-2', role: 'member' as const, status: 'active' as const };
    expect(updateCloudMemberDraft(existing, { role: 'admin', status: 'suspended' })).toEqual({
      role: 'admin',
      status: 'suspended',
    });

    expect(updateCloudMemberDraft(existing, {})).toEqual({});
    expect(() => updateCloudMemberDraft(existing, { role: 'owner' })).toThrow(
      'Use ownership transfer to promote a member to owner'
    );
    expect(() => updateCloudMemberDraft({ ...existing, role: 'owner' }, { role: 'admin' })).toThrow(
      'Use ownership transfer to change the owner role'
    );
    expect(() => updateCloudMemberDraft({ ...existing, role: 'owner' }, { status: 'suspended' })).toThrow(
      'Owner membership cannot be suspended'
    );
  });

  it('creates deterministic ownership transfer role updates for active members only', () => {
    expect(
      createOwnershipTransferRoleUpdates(
        { organizationId: 'org-1', userId: 'owner-user', role: 'owner', status: 'active' },
        { organizationId: 'org-1', userId: 'target-user', role: 'admin', status: 'active' }
      )
    ).toEqual([
      { userId: 'owner-user', role: 'admin' },
      { userId: 'target-user', role: 'owner' },
    ]);

    expect(() =>
      createOwnershipTransferRoleUpdates(
        { organizationId: 'org-1', userId: 'admin-user', role: 'admin', status: 'active' },
        { organizationId: 'org-1', userId: 'target-user', role: 'member', status: 'active' }
      )
    ).toThrow('Only the current owner can transfer ownership');
    expect(() =>
      createOwnershipTransferRoleUpdates(
        { organizationId: 'org-1', userId: 'owner-user', role: 'owner', status: 'active' },
        { organizationId: 'org-1', userId: 'target-user', role: 'member', status: 'pending' }
      )
    ).toThrow('Ownership can only transfer to an active member');
  });
});
