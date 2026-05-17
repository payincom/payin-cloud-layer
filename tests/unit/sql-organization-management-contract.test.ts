import { describe, expect, it } from 'vitest';
import { SqlCloudOrganizationRepository, SqlQueryRecorder } from '../../src/index.js';

const tenant = { organizationId: 'org-sql-organization', tenantId: 'org-sql-organization' };

describe('SQL organization management contracts', () => {
  it('loads and updates current organization by tenant', async () => {
    const db = new SqlQueryRecorder([{ id: tenant.organizationId, name: 'SQL Org', slug: 'sql-org', plan_type: 'pro' }]);
    const repo = new SqlCloudOrganizationRepository(db);

    await expect(repo.getByTenant(tenant)).resolves.toMatchObject({ id: tenant.organizationId, name: 'SQL Org', planType: 'pro' });
    expect(db.queries[0]).toEqual({ text: 'SELECT * FROM organizations WHERE id = $1 LIMIT 1', values: [tenant.organizationId] });

    await repo.updateByTenant(tenant, { name: 'Updated SQL Org', slug: 'updated-sql-org' });
    expect(db.queries[1]).toEqual({
      text: 'UPDATE organizations SET name = $1, slug = $2 WHERE id = $3 RETURNING *',
      values: ['Updated SQL Org', 'updated-sql-org', tenant.organizationId],
    });
  });

  it('lists and adds tenant members', async () => {
    const db = new SqlQueryRecorder([{ id: 'member-sql', organization_id: tenant.organizationId, user_id: 'user-sql', role: 'member', status: 'active' }]);
    const repo = new SqlCloudOrganizationRepository(db);

    await expect(repo.listMembers(tenant)).resolves.toMatchObject([{ organizationId: tenant.organizationId, userId: 'user-sql', role: 'member' }]);
    expect(db.queries[0]).toEqual({ text: 'SELECT * FROM organization_members WHERE organization_id = $1 ORDER BY created_at ASC', values: [tenant.organizationId] });

    await repo.addMember({ organizationId: tenant.organizationId, userId: 'user-new', role: 'viewer', status: 'active', joinedAt: new Date('2026-05-17T00:25:00.000Z') });
    expect(db.queries[1]).toEqual({
      text: 'INSERT INTO organization_members (organization_id, user_id, role, status, invited_by, invited_at, joined_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      values: [tenant.organizationId, 'user-new', 'viewer', 'active', undefined, undefined, new Date('2026-05-17T00:25:00.000Z')],
    });
  });

  it('updates tenant members', async () => {
    const db = new SqlQueryRecorder([{ organization_id: tenant.organizationId, user_id: 'user-sql', role: 'viewer', status: 'active' }]);
    const repo = new SqlCloudOrganizationRepository(db);

    await expect(repo.updateMember(tenant, 'user-sql', { role: 'viewer', status: 'active' })).resolves.toMatchObject({ userId: 'user-sql', role: 'viewer' });
    expect(db.queries[0]).toEqual({
      text: 'UPDATE organization_members SET role = $1, status = $2 WHERE organization_id = $3 AND user_id = $4 RETURNING *',
      values: ['viewer', 'active', tenant.organizationId, 'user-sql'],
    });
  });
});
