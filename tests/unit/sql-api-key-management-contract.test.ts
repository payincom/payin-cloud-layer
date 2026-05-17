import { describe, expect, it } from 'vitest';
import { SqlCloudApiKeyRepository, SqlQueryRecorder } from '../../src/index.js';

const tenant = { organizationId: 'org-sql-api-key', tenantId: 'org-sql-api-key' };

describe('SQL API key management contracts', () => {
  it('creates API key metadata without returning raw secret from storage', async () => {
    const db = new SqlQueryRecorder([{ id: 'key-sql', key_prefix: 'pk_live_', name: 'SQL key', organization_id: tenant.organizationId, role: 'member', capabilities: ['orders:create'], created_at: new Date('2026-05-16T23:58:00.000Z') }]);
    const repo = new SqlCloudApiKeyRepository(db);

    await expect(repo.create({
      presentedKey: 'pk_live_secret_sql',
      tenant,
      apiKey: { id: 'key-sql', keyPrefix: 'pk_live_', name: 'SQL key', organizationId: tenant.organizationId, role: 'member', capabilities: ['orders:create'], createdAt: new Date('2026-05-16T23:58:00.000Z') },
      membership: { role: 'member', status: 'active' },
    })).resolves.toMatchObject({ id: 'key-sql', keyPrefix: 'pk_live_', organizationId: tenant.organizationId });

    expect(db.queries[0]).toEqual({
      text: 'INSERT INTO api_keys (id, key_hash, key_prefix, name, organization_id, user_id, role, capabilities, expires_at, created_at, metadata) VALUES ($1, crypt($2, gen_salt(\'bf\')), $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      values: ['key-sql', 'pk_live_secret_sql', 'pk_live_', 'SQL key', tenant.organizationId, undefined, 'member', ['orders:create'], undefined, new Date('2026-05-16T23:58:00.000Z'), undefined],
    });
  });

  it('lists tenant scoped API key metadata', async () => {
    const db = new SqlQueryRecorder([{ id: 'key-sql', key_prefix: 'pk_live_', name: 'SQL key', organization_id: tenant.organizationId, role: 'member' }]);
    const repo = new SqlCloudApiKeyRepository(db);

    await expect(repo.listForTenant(tenant)).resolves.toMatchObject([{ id: 'key-sql', organizationId: tenant.organizationId }]);
    expect(db.queries[0]).toEqual({
      text: 'SELECT * FROM api_keys WHERE organization_id = $1 ORDER BY created_at ASC',
      values: [tenant.organizationId],
    });
  });

  it('revokes tenant scoped API keys', async () => {
    const revokedAt = new Date('2026-05-16T23:59:00.000Z');
    const db = new SqlQueryRecorder([{ id: 'key-sql', key_prefix: 'pk_live_', name: 'SQL key', organization_id: tenant.organizationId, revoked_at: revokedAt }]);
    const repo = new SqlCloudApiKeyRepository(db);

    await expect(repo.revokeForTenant('key-sql', tenant, revokedAt)).resolves.toMatchObject({ id: 'key-sql', revokedAt });
    expect(db.queries[0]).toEqual({
      text: 'UPDATE api_keys SET revoked_at = $1 WHERE id = $2 AND organization_id = $3 RETURNING *',
      values: [revokedAt, 'key-sql', tenant.organizationId],
    });
  });
});
