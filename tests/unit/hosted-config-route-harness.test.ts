import { describe, expect, it } from 'vitest';
import { createCloudHostedConfigRouteHandlers, type CloudHostedConfigService } from '../../src/index.js';

describe('Cloud hosted config route harness', () => {
  it('maps get/update config routes to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudHostedConfigRouteHandlers({
      configs: {
        async getConfig(input: unknown) { calls.push(['get', input]); return { tenant: { organizationId: 'org-route', tenantId: 'org-route' }, enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'], limits: {}, isChainEnabled: () => true, isTokenEnabled: () => true }; },
        async updateConfig(input: unknown) { calls.push(['update', input]); return { tenant: { organizationId: 'org-route', tenantId: 'org-route' }, enabledChains: ['base-sepolia'], enabledTokens: ['EURC'], limits: {}, isChainEnabled: () => true, isTokenEnabled: () => true }; },
      } as Pick<CloudHostedConfigService, 'getConfig' | 'updateConfig'>,
    });

    await expect(handlers.getConfig({ headers: { authorization: 'Bearer pk' }, body: undefined })).resolves.toMatchObject({ status: 200, body: { data: { enabledChains: ['ethereum-sepolia'] } } });
    await expect(handlers.updateConfig({ headers: { authorization: 'Bearer pk' }, body: { enabledChains: ['base-sepolia'], enabledTokens: ['EURC'] } })).resolves.toMatchObject({ status: 200, body: { data: { enabledChains: ['base-sepolia'], enabledTokens: ['EURC'] } } });
    expect(calls).toEqual([
      ['get', { apiKey: 'pk' }],
      ['update', { apiKey: 'pk', enabledChains: ['base-sepolia'], enabledTokens: ['EURC'] }],
    ]);
  });
});
