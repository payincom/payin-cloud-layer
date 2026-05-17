import { describe, expect, it } from 'vitest';
import { createCloudAddressPoolRouteHandlers, type CloudAddressPoolService } from '../../src/index.js';

describe('Cloud address pool route harness', () => {
  it('maps address import input to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudAddressPoolRouteHandlers({
      addressPool: {
        async importAddresses(input: unknown) {
          calls.push(input);
          return [{ tenant: { organizationId: 'org-route', tenantId: 'org-route' }, protocol: 'evm', address: '0xabc', state: 'idle' }];
        },
        async getSummary() { throw new Error('unused'); },
        async listAddresses() { throw new Error('unused'); },
      } as unknown as Pick<CloudAddressPoolService, 'importAddresses' | 'getSummary' | 'listAddresses'>,
    });

    await expect(handlers.importAddresses({
      headers: { authorization: 'Bearer pk_live_route' },
      body: { protocol: 'evm', addresses: [{ address: '0xabc', derivationIndex: 0 }], masterPublicKeyRef: 'secret://xpub/route' },
    })).resolves.toEqual({ status: 201, body: { data: [{ tenant: { organizationId: 'org-route', tenantId: 'org-route' }, protocol: 'evm', address: '0xabc', state: 'idle' }] } });

    expect(calls).toEqual([{ apiKey: 'pk_live_route', protocol: 'evm', addresses: [{ address: '0xabc', derivationIndex: 0 }], masterPublicKeyRef: 'secret://xpub/route' }]);
  });

  it('maps summary input to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudAddressPoolRouteHandlers({
      addressPool: {
        async importAddresses() { throw new Error('unused'); },
        async getSummary(input: unknown) {
          calls.push(input);
          return { tenant: { organizationId: 'org-route', tenantId: 'org-route' }, totalAddresses: 1, hasAddresses: true, protocols: [] };
        },
        async listAddresses() { throw new Error('unused'); },
      } as unknown as Pick<CloudAddressPoolService, 'importAddresses' | 'getSummary' | 'listAddresses'>,
    });

    await expect(handlers.getSummary({ headers: { authorization: 'Bearer pk_live_route' }, body: undefined })).resolves.toEqual({
      status: 200,
      body: { data: { tenant: { organizationId: 'org-route', tenantId: 'org-route' }, totalAddresses: 1, hasAddresses: true, protocols: [] } },
    });
    expect(calls).toEqual([{ apiKey: 'pk_live_route' }]);
  });

  it('maps list address input to service filters', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudAddressPoolRouteHandlers({
      addressPool: {
        async importAddresses() { throw new Error('unused'); },
        async getSummary() { throw new Error('unused'); },
        async listAddresses(input: unknown) {
          calls.push(input);
          return [{ tenant: { organizationId: 'org-route', tenantId: 'org-route' }, protocol: 'evm', address: '0xabc', state: 'idle' }];
        },
      } as unknown as Pick<CloudAddressPoolService, 'importAddresses' | 'getSummary' | 'listAddresses'>,
    });

    await expect(handlers.listAddresses({ headers: { authorization: 'Bearer pk_live_route' }, query: { protocol: 'evm', state: 'idle' }, body: undefined })).resolves.toEqual({
      status: 200,
      body: { data: [{ tenant: { organizationId: 'org-route', tenantId: 'org-route' }, protocol: 'evm', address: '0xabc', state: 'idle' }] },
    });
    expect(calls).toEqual([{ apiKey: 'pk_live_route', protocol: 'evm', state: 'idle' }]);
  });
});
