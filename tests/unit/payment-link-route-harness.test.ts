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
      } as Pick<CloudPaymentLinkService, 'createPaymentLink' | 'publishPaymentLink'>,
    });

    await expect(handlers.createPaymentLink({
      headers: { authorization: 'Bearer pk_live_route' },
      body: { title: 'Checkout', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryTotal: 10 },
    })).resolves.toEqual({ status: 201, body: { data: { id: 'plink-route-1', status: 'draft', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, title: 'Checkout', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryReserved: 0 } } });

    expect(calls).toEqual([{ apiKey: 'pk_live_route', title: 'Checkout', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryTotal: 10 }]);
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
      } as Pick<CloudPaymentLinkService, 'createPaymentLink' | 'publishPaymentLink'>,
    });

    await expect(handlers.publishPaymentLink({
      headers: { authorization: 'Bearer pk_live_route' },
      params: { paymentLinkId: 'plink-route-1' },
      body: { slug: 'checkout' },
    })).resolves.toEqual({ status: 200, body: { data: { id: 'plink-route-1', status: 'published', slug: 'checkout', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, title: 'Checkout', amount: '12.00', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryReserved: 0 } } });

    expect(calls).toEqual([{ apiKey: 'pk_live_route', paymentLinkId: 'plink-route-1', slug: 'checkout' }]);
  });
});
