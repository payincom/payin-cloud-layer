import { describe, expect, it } from 'vitest';
import { createCloudApiKeyRouteHandlers, type CloudApiKeyService } from '../../src/index.js';

describe('Cloud API key route harness', () => {
  it('maps create API key input to service and returns one-time presented key', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudApiKeyRouteHandlers({
      apiKeys: {
        async createApiKey(input: unknown) {
          calls.push(input);
          return { presentedKey: 'pk_live_once', apiKey: { id: 'key-route', keyPrefix: 'pk_live_', name: 'Route key', organizationId: 'org-route' } };
        },
        async listApiKeys() { throw new Error('unused'); },
        async revokeApiKey() { throw new Error('unused'); },
      } as Pick<CloudApiKeyService, 'createApiKey' | 'listApiKeys' | 'revokeApiKey'>,
    });

    await expect(handlers.createApiKey({
      headers: { authorization: 'Bearer pk_live_admin' },
      body: { name: 'Route key', role: 'member', capabilities: ['orders:create'] },
    })).resolves.toEqual({ status: 201, body: { data: { presentedKey: 'pk_live_once', apiKey: { id: 'key-route', keyPrefix: 'pk_live_', name: 'Route key', organizationId: 'org-route' } } } });

    expect(calls).toEqual([{ apiKey: 'pk_live_admin', name: 'Route key', role: 'member', capabilities: ['orders:create'] }]);
  });

  it('maps list API keys input to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudApiKeyRouteHandlers({
      apiKeys: {
        async createApiKey() { throw new Error('unused'); },
        async listApiKeys(input: unknown) { calls.push(input); return [{ id: 'key-route', keyPrefix: 'pk_live_', name: 'Route key', organizationId: 'org-route' }]; },
        async revokeApiKey() { throw new Error('unused'); },
      } as Pick<CloudApiKeyService, 'createApiKey' | 'listApiKeys' | 'revokeApiKey'>,
    });

    await expect(handlers.listApiKeys({ headers: { authorization: 'Bearer pk_live_admin' }, body: undefined })).resolves.toEqual({
      status: 200,
      body: { data: [{ id: 'key-route', keyPrefix: 'pk_live_', name: 'Route key', organizationId: 'org-route' }] },
    });
    expect(calls).toEqual([{ apiKey: 'pk_live_admin' }]);
  });

  it('maps revoke API key input to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudApiKeyRouteHandlers({
      apiKeys: {
        async createApiKey() { throw new Error('unused'); },
        async listApiKeys() { throw new Error('unused'); },
        async revokeApiKey(input: unknown) { calls.push(input); return { id: 'key-route', keyPrefix: 'pk_live_', name: 'Route key', organizationId: 'org-route', revokedAt: new Date('2026-05-16T23:59:00.000Z') }; },
      } as Pick<CloudApiKeyService, 'createApiKey' | 'listApiKeys' | 'revokeApiKey'>,
    });

    await expect(handlers.revokeApiKey({ headers: { authorization: 'Bearer pk_live_admin' }, params: { apiKeyId: 'key-route' }, body: undefined })).resolves.toEqual({
      status: 200,
      body: { data: { id: 'key-route', keyPrefix: 'pk_live_', name: 'Route key', organizationId: 'org-route', revokedAt: new Date('2026-05-16T23:59:00.000Z') } },
    });
    expect(calls).toEqual([{ apiKey: 'pk_live_admin', apiKeyId: 'key-route' }]);
  });
});
