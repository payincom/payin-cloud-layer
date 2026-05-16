import { describe, expect, it } from 'vitest';
import {
  SqlCloudApiKeyRepository,
  SqlCloudTenantResolver,
  SqlQueryRecorder,
} from '../../src/index.js';

describe('SQL auth adapter contract', () => {
  it('loads active tenant membership through parameterized SQL', async () => {
    const db = new SqlQueryRecorder([{ user_id: 'user-1', organization_id: 'org-1', role: 'admin', status: 'active', plan_type: 'pro' }]);
    const resolver = new SqlCloudTenantResolver(db);

    await expect(resolver.resolveForUser('user-1', 'org-1')).resolves.toEqual({
      userId: 'user-1',
      tenant: { organizationId: 'org-1', tenantId: 'org-1', plan: 'pro' },
      role: 'admin',
      status: 'active',
    });
    expect(db.queries[0]).toEqual({
      text: 'SELECT om.user_id, om.organization_id, om.role, om.status, o.plan_type FROM organization_members om JOIN organizations o ON o.id = om.organization_id WHERE om.user_id = $1 AND om.organization_id = $2 LIMIT 1',
      values: ['user-1', 'org-1'],
    });
  });

  it('loads API key metadata without exposing key hashes or raw secrets', async () => {
    const db = new SqlQueryRecorder([{ id: 'key-1', key_prefix: 'pk_live_', name: 'Orders', organization_id: 'org-1', user_id: 'user-1', role: 'admin', status: 'active', plan_type: 'pro' }]);
    const repository = new SqlCloudApiKeyRepository(db);

    await expect(repository.findByPresentedKey('pk_live_secret')).resolves.toMatchObject({
      apiKey: {
        id: 'key-1',
        keyPrefix: 'pk_live_',
        name: 'Orders',
        organizationId: 'org-1',
        userId: 'user-1',
        role: 'admin',
      },
      membership: { role: 'admin', status: 'active' },
      tenant: { organizationId: 'org-1', tenantId: 'org-1', plan: 'pro' },
    });
    expect(JSON.stringify(await repository.findByPresentedKey('pk_live_secret'))).not.toContain('pk_live_secret');
    expect(db.queries[0]).toEqual({
      text: 'SELECT ak.id, ak.key_prefix, ak.name, ak.organization_id, ak.user_id, ak.expires_at, ak.revoked_at, om.role, om.status, o.plan_type FROM api_keys ak JOIN organization_members om ON om.user_id = ak.user_id AND om.organization_id = ak.organization_id JOIN organizations o ON o.id = ak.organization_id WHERE ak.key_prefix = $1 LIMIT 1',
      values: ['pk_live_'],
    });
  });
});
