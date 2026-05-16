import { describe, expect, it, vi } from 'vitest';
import {
  CloudApiKeyAuthenticationError,
  CloudApiKeyAuthenticator,
  CloudApiKeyAuthorizationError,
  InMemoryCloudApiKeyRepository,
  deriveCloudApiKeyCapabilities,
  getCloudApiKeyStatus,
  type CloudApiKey,
  type CloudApiKeyRepository,
} from '../../src/index.js';

const now = new Date('2026-05-16T12:35:00.000Z');

function activeRecord(overrides: Record<string, unknown> = {}) {
  return {
    presentedKey: 'pk_live_valid',
    apiKey: {
      id: 'key-1',
      keyPrefix: 'pk_live_',
      name: 'Orders service',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'admin' as const,
      ...overrides,
    },
    membership: { role: 'admin' as const, status: 'active' as const },
    tenant: { organizationId: 'org-1', plan: 'pro' as const },
  };
}

describe('Cloud API key boundary', () => {
  it('authenticates an active key into explicit tenant scope', async () => {
    const repository = new InMemoryCloudApiKeyRepository([activeRecord()]);
    const authenticator = new CloudApiKeyAuthenticator(repository);

    await expect(authenticator.authenticate('pk_live_valid', now)).resolves.toMatchObject({
      apiKeyId: 'key-1',
      tenant: { organizationId: 'org-1', tenantId: 'org-1', plan: 'pro' },
      userId: 'user-1',
      role: 'admin',
      capabilities: expect.arrayContaining(['orders:create', 'api-keys:revoke', 'config:update']),
    });
  });

  it('records successful key use without exposing raw key material', async () => {
    const record = activeRecord() as ReturnType<typeof activeRecord> & { apiKey: CloudApiKey };
    const repository = new InMemoryCloudApiKeyRepository([record]);
    const authenticator = new CloudApiKeyAuthenticator(repository);

    const scope = await authenticator.authenticate('pk_live_valid', now);

    expect(scope).not.toHaveProperty('presentedKey');
    expect(record.apiKey.lastUsedAt).toEqual(now);
  });

  it('rejects missing, unknown, revoked, and expired keys', async () => {
    const authenticator = new CloudApiKeyAuthenticator(new InMemoryCloudApiKeyRepository([
      activeRecord({ id: 'revoked-key', revokedAt: new Date('2026-05-16T12:34:00.000Z') }),
      { ...activeRecord({ id: 'expired-key', expiresAt: new Date('2026-05-16T12:34:59.000Z') }), presentedKey: 'pk_live_expired' },
    ]));

    await expect(authenticator.authenticate('   ', now)).rejects.toThrow('Cloud API key is required');
    await expect(authenticator.authenticate('pk_live_missing', now)).rejects.toThrow('Cloud API key not found');
    await expect(authenticator.authenticate('pk_live_valid', now)).rejects.toThrow('Cloud API key is revoked');
    await expect(authenticator.authenticate('pk_live_expired', now)).rejects.toThrow('Cloud API key is expired');
  });

  it('rejects keys whose membership is not active', async () => {
    const authenticator = new CloudApiKeyAuthenticator(new InMemoryCloudApiKeyRepository([
      { ...activeRecord(), membership: { role: 'admin', status: 'suspended' } },
    ]));

    await expect(authenticator.authenticate('pk_live_valid', now)).rejects.toThrow('Membership status is suspended');
  });

  it('rejects tenant mismatch between key scope and resolved tenant context', async () => {
    const authenticator = new CloudApiKeyAuthenticator(new InMemoryCloudApiKeyRepository([
      { ...activeRecord(), tenant: { organizationId: 'org-2' } },
    ]));

    await expect(authenticator.authenticate('pk_live_valid', now)).rejects.toThrow(
      'Cloud API key tenant does not match organization scope'
    );
  });

  it('derives capabilities from explicit key capability overrides before role defaults', () => {
    expect(deriveCloudApiKeyCapabilities({
      id: 'key-1',
      keyPrefix: 'pk_live_',
      name: 'Read only key',
      organizationId: 'org-1',
      role: 'admin',
      capabilities: ['orders:read', 'orders:read'],
    })).toEqual(['orders:read']);
  });

  it('enforces requested capabilities from authenticated scope', async () => {
    const authenticator = new CloudApiKeyAuthenticator(new InMemoryCloudApiKeyRepository([
      activeRecord({ role: 'viewer' }),
    ]));
    const scope = await authenticator.authenticate('pk_live_valid', now);

    await expect(authenticator.assertCapability(scope, 'orders:read')).resolves.toBeUndefined();
    await expect(authenticator.assertCapability(scope, 'orders:create')).rejects.toBeInstanceOf(CloudApiKeyAuthorizationError);
  });

  it('supports repository adapters that verify raw keys without leaking storage implementation', async () => {
    const repository: CloudApiKeyRepository = {
      findByPresentedKey: vi.fn(async (presentedKey: string) => {
        if (presentedKey !== 'pk_live_adapter') return { apiKey: null };
        return activeRecord({ id: 'adapter-key' });
      }),
      recordSuccessfulUse: vi.fn(),
    };
    const authenticator = new CloudApiKeyAuthenticator(repository);

    await expect(authenticator.authenticate('pk_live_adapter', now)).resolves.toMatchObject({
      apiKeyId: 'adapter-key',
      tenant: { organizationId: 'org-1' },
    });
    expect(repository.findByPresentedKey).toHaveBeenCalledWith('pk_live_adapter');
    expect(repository.recordSuccessfulUse).toHaveBeenCalledWith('adapter-key', now);
  });

  it('reports key status deterministically', () => {
    expect(getCloudApiKeyStatus({}, now)).toBe('active');
    expect(getCloudApiKeyStatus({ revokedAt: now }, now)).toBe('revoked');
    expect(getCloudApiKeyStatus({ expiresAt: now }, now)).toBe('expired');
  });

  it('uses role-derived capabilities when no explicit key capabilities are stored', () => {
    expect(deriveCloudApiKeyCapabilities({
      id: 'key-1',
      keyPrefix: 'pk_live_',
      name: 'Viewer key',
      organizationId: 'org-1',
      role: 'viewer',
    })).toEqual(expect.arrayContaining(['orders:read', 'payment-links:read', 'config:read']));
  });
});
