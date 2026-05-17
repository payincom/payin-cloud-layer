import { describe, expect, it } from 'vitest';
import {
  CloudApiKeyAuthenticator,
  CloudOrganizationService,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudOrganizationRepository,
  StaticEntitlementProvider,
} from '../../src/index.js';

const tenant = { organizationId: 'org-member-service', tenantId: 'org-member-service', plan: 'pro' as const };

function service(role: 'owner' | 'admin' | 'member' | 'viewer' = 'admin') {
  const auditTrail = new InMemoryCloudAuditTrail();
  const organizations = new InMemoryCloudOrganizationRepository([
    { id: tenant.organizationId, name: 'Merchant Org', slug: 'merchant-org', planType: 'pro' },
  ], [
    { id: 'member-admin', organizationId: tenant.organizationId, userId: 'user-admin', role, status: 'active' },
  ]);
  const apiKeys = new InMemoryCloudApiKeyRepository([
    {
      presentedKey: 'pk_live_org_admin',
      apiKey: { id: 'key-org-admin', keyPrefix: 'pk_live_', name: 'Org admin', organizationId: tenant.organizationId, userId: 'user-admin', role },
      membership: { role, status: 'active' },
      tenant,
    },
  ]);
  return {
    auditTrail,
    organizations,
    service: new CloudOrganizationService({
      authenticator: new CloudApiKeyAuthenticator(apiKeys),
      entitlementProvider: new StaticEntitlementProvider(['config:read', 'config:update']),
      organizations,
      auditTrail,
    }),
  };
}

describe('CloudOrganizationService', () => {
  it('returns current organization and members for active scoped API keys', async () => {
    const setup = service();
    await setup.service.addMember({ apiKey: 'pk_live_org_admin', userId: 'user-member', role: 'member' });

    await expect(setup.service.getCurrentOrganization({ apiKey: 'pk_live_org_admin' })).resolves.toMatchObject({ id: tenant.organizationId, name: 'Merchant Org' });
    await expect(setup.service.listMembers({ apiKey: 'pk_live_org_admin' })).resolves.toMatchObject([
      { userId: 'user-admin', role: 'admin' },
      { userId: 'user-member', role: 'member', status: 'active' },
    ]);
  });

  it('updates organization metadata through permission and audit', async () => {
    const setup = service();

    const updated = await setup.service.updateOrganization({ apiKey: 'pk_live_org_admin', name: 'Updated Merchant', slug: 'updated-merchant', now: new Date('2026-05-17T00:20:00.000Z') });

    expect(updated).toMatchObject({ id: tenant.organizationId, name: 'Updated Merchant', slug: 'updated-merchant' });
    expect(await setup.auditTrail.list({ tenantId: tenant.organizationId, action: 'config:update' })).toMatchObject([
      { actor: { type: 'api_key', id: 'key-org-admin' }, subjectId: tenant.organizationId, metadata: { resource: 'organization' } },
    ]);
  });

  it('adds and updates members through organization permissions', async () => {
    const setup = service();

    const added = await setup.service.addMember({ apiKey: 'pk_live_org_admin', userId: 'user-member', role: 'member', now: new Date('2026-05-17T00:21:00.000Z') });
    const updated = await setup.service.updateMember({ apiKey: 'pk_live_org_admin', userId: 'user-member', role: 'viewer', status: 'active', now: new Date('2026-05-17T00:22:00.000Z') });

    expect(added).toMatchObject({ organizationId: tenant.organizationId, userId: 'user-member', role: 'member', status: 'active' });
    expect(updated).toMatchObject({ organizationId: tenant.organizationId, userId: 'user-member', role: 'viewer', status: 'active' });
    expect(await setup.auditTrail.list({ tenantId: tenant.organizationId, action: 'config:update' })).toHaveLength(2);
  });

  it('rejects member role before mutating organization members', async () => {
    const setup = service('member');

    await expect(setup.service.addMember({ apiKey: 'pk_live_org_admin', userId: 'user-other', role: 'viewer' })).rejects.toThrow('Cloud organization permission members:add requires a higher role');
    expect(await setup.organizations.listMembers(tenant)).toHaveLength(1);
  });
});
