import { describe, expect, it } from 'vitest';
import { createCloudPaymentLinkRouteHandlers, type CloudPaymentLinkService } from '../../src/index.js';

describe('Cloud payment link route harness', () => {
  it('maps create payment link input to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudPaymentLinkRouteHandlers({
      paymentLinks: {
        async createPaymentLink(input: unknown) {
          calls.push(input);
          return { id: 'plink-route-1', status: 'draft', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, title: 'Checkout', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryReserved: 0 };
        },
        async publishPaymentLink() { throw new Error('unused'); },
        async getPaymentLink() { throw new Error('unused'); },
        async listPaymentLinks() { throw new Error('unused'); },
      } as unknown as Pick<CloudPaymentLinkService, 'createPaymentLink' | 'publishPaymentLink' | 'getPaymentLink' | 'listPaymentLinks'>,
    });

    await expect(handlers.createPaymentLink({
      headers: { authorization: 'Bearer pk_live_route' },
      body: { title: 'Checkout', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryTotal: 10 },
    })).resolves.toEqual({ status: 201, body: { data: { id: 'plink-route-1', status: 'draft', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, title: 'Checkout', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryReserved: 0 } } });

    expect(calls).toEqual([{ apiKey: 'pk_live_route', title: 'Checkout', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryTotal: 10 }]);
  });

  it('maps legacy admin multi-currency create input to the primary payment link shape', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudPaymentLinkRouteHandlers({
      paymentLinks: {
        async createPaymentLink(input: unknown) {
          calls.push(input);
          return { id: 'plink-route-2', status: 'draft' };
        },
        async publishPaymentLink() { throw new Error('unused'); },
        async getPaymentLink() { throw new Error('unused'); },
        async listPaymentLinks() { throw new Error('unused'); },
      } as unknown as Pick<CloudPaymentLinkService, 'createPaymentLink' | 'publishPaymentLink' | 'getPaymentLink' | 'listPaymentLinks'>,
    });

    await expect(handlers.createPaymentLink({
      headers: { authorization: 'Bearer pk_live_route' },
      body: { title: 'Multi', amount: '10.00', currencies: [{ currency: 'USDC', chainOptions: ['ethereum-sepolia'], amount: '12.00', isPrimary: true }], amountType: 'fixed', ctaText: 'Pay now', theme: 'dark' },
    })).resolves.toEqual({ status: 201, body: { data: { id: 'plink-route-2', status: 'draft' } } });

    expect(calls).toEqual([{ apiKey: 'pk_live_route', title: 'Multi', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], metadata: { currencies: [{ currency: 'USDC', chain_options: ['ethereum-sepolia'], chainOptions: ['ethereum-sepolia'], amount: '12.00', is_primary: true, isPrimary: true }], amountType: 'fixed', ctaText: 'Pay now', theme: 'dark' } }]);
  });

  it('maps publish payment link input to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudPaymentLinkRouteHandlers({
      paymentLinks: {
        async createPaymentLink() { throw new Error('unused'); },
        async publishPaymentLink(input: unknown) {
          calls.push(input);
          return { id: 'plink-route-1', status: 'published', slug: 'checkout', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, title: 'Checkout', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryReserved: 0 };
        },
        async getPaymentLink() { throw new Error('unused'); },
        async listPaymentLinks() { throw new Error('unused'); },
      } as unknown as Pick<CloudPaymentLinkService, 'createPaymentLink' | 'publishPaymentLink' | 'getPaymentLink' | 'listPaymentLinks'>,
    });

    await expect(handlers.publishPaymentLink({
      headers: { authorization: 'Bearer pk_live_route' },
      params: { paymentLinkId: 'plink-route-1' },
      body: { slug: 'checkout' },
    })).resolves.toEqual({ status: 200, body: { data: { id: 'plink-route-1', status: 'published', slug: 'checkout', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, title: 'Checkout', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryReserved: 0 } } });

    expect(calls).toEqual([{ apiKey: 'pk_live_route', paymentLinkId: 'plink-route-1', slug: 'checkout' }]);
  });

  it('maps get/list payment link input to read service methods with pagination', async () => {
    const calls: unknown[] = [];
    const link = { id: 'plink-route-1', status: 'published', tenant: { organizationId: 'org-route' } };
    const handlers = createCloudPaymentLinkRouteHandlers({
      paymentLinks: {
        async createPaymentLink() { throw new Error('unused'); },
        async publishPaymentLink() { throw new Error('unused'); },
        async getPaymentLink(input: unknown) { calls.push(['get', input]); return link; },
        async listPaymentLinks(input: unknown) { calls.push(['list', input]); return [link]; },
      } as unknown as Pick<CloudPaymentLinkService, 'createPaymentLink' | 'publishPaymentLink' | 'getPaymentLink' | 'listPaymentLinks'>,
    });

    await expect(handlers.getPaymentLink({ headers: { authorization: 'Bearer pk_live_route' }, params: { paymentLinkId: 'plink-route-1' }, body: undefined })).resolves.toEqual({ status: 200, body: { data: link } });
    await expect(handlers.listPaymentLinks({ headers: { authorization: 'Bearer pk_live_route' }, query: { status: 'published', page: 1, limit: 5 }, body: undefined })).resolves.toEqual({ status: 200, body: { data: [link], pagination: { page: 1, limit: 5, total: 1, totalPages: 1 } } });
    expect(calls).toEqual([
      ['get', { apiKey: 'pk_live_route', paymentLinkId: 'plink-route-1' }],
      ['list', { apiKey: 'pk_live_route', status: 'published' }],
    ]);
  });
});
