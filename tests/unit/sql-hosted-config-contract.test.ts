import { describe, expect, it } from 'vitest';
import { SqlHostedConfigRepository, SqlQueryRecorder } from '../../src/index.js';

const tenant = { organizationId: 'org-sql-config', tenantId: 'org-sql-config', plan: 'pro' as const };

describe('SQL hosted config repository contracts', () => {
  it('loads tenant config from SQL row', async () => {
    const db = new SqlQueryRecorder([
      {
        organization_id: tenant.organizationId,
        api_base_url: 'https://api.payin.example',
        enabled_chains: ['ethereum-sepolia'],
        enabled_tokens: ['USDC'],
        secret_refs: { webhookSigningSecretRef: 'secret://webhooks/sql' },
        limits: { apiKeyLimit: 10 },
        metadata: { region: 'test' },
      },
    ]);
    const repo = new SqlHostedConfigRepository(db);

    await expect(repo.getTenantConfig(tenant)).resolves.toMatchObject({
      tenant,
      apiBaseUrl: 'https://api.payin.example',
      enabledChains: ['ethereum-sepolia'],
      enabledTokens: ['USDC'],
      secretRefs: { webhookSigningSecretRef: 'secret://webhooks/sql' },
      limits: { apiKeyLimit: 10 },
      metadata: { region: 'test' },
    });
    expect(db.queries[0]).toEqual({
      text: 'SELECT * FROM hosted_configs WHERE organization_id = $1 LIMIT 1',
      values: [tenant.organizationId],
    });
  });

  it('falls back to defaults when no SQL row exists', async () => {
    const db = new SqlQueryRecorder([]);
    const repo = new SqlHostedConfigRepository(db, { defaults: { enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'], limits: { apiKeyLimit: 2 } } });

    await expect(repo.getTenantConfig(tenant)).resolves.toMatchObject({ enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'], limits: { apiKeyLimit: 2 } });
  });

  it('upserts tenant config updates', async () => {
    const db = new SqlQueryRecorder([
      { organization_id: tenant.organizationId, enabled_chains: ['base-sepolia'], enabled_tokens: ['EURC'], limits: { apiKeyLimit: 5 } },
    ]);
    const repo = new SqlHostedConfigRepository(db);

    await expect(repo.updateTenantConfig(tenant, { enabledChains: ['base-sepolia'], enabledTokens: ['EURC'], limits: { apiKeyLimit: 5 } })).resolves.toMatchObject({
      tenant,
      enabledChains: ['base-sepolia'],
      enabledTokens: ['EURC'],
      limits: { apiKeyLimit: 5 },
    });
    expect(db.queries[0]).toEqual({
      text: 'INSERT INTO hosted_configs (organization_id, api_base_url, enabled_chains, enabled_tokens, secret_refs, limits, metadata, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (organization_id) DO UPDATE SET api_base_url = EXCLUDED.api_base_url, enabled_chains = EXCLUDED.enabled_chains, enabled_tokens = EXCLUDED.enabled_tokens, secret_refs = EXCLUDED.secret_refs, limits = EXCLUDED.limits, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at RETURNING *',
      values: [tenant.organizationId, undefined, ['base-sepolia'], ['EURC'], undefined, { apiKeyLimit: 5 }, undefined, expect.any(Date)],
    });
  });
});
