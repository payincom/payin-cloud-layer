import { describe, expect, it } from 'vitest';
import { createCloudRouteHandlers, createRuntimeReadinessReport } from '../../src/index.js';

describe('createCloudRouteHandlers', () => {
  it('assembles thin route handlers from service layer', async () => {
    const routes = createCloudRouteHandlers({
      services: {
        orders: { createOrder: async () => ({ id: 'order-factory' }), getOrder: async () => ({ id: 'order-factory' }), listOrders: async () => [{ id: 'order-factory' }] },
        paymentLinks: {
          createPaymentLink: async () => ({ id: 'plink-factory' }),
          publishPaymentLink: async () => ({ id: 'plink-factory', status: 'published' }),
          getPaymentLink: async () => ({ id: 'plink-factory' }),
          listPaymentLinks: async () => [{ id: 'plink-factory' }],
        },
        readiness: {
          getReadiness: async () => createRuntimeReadinessReport({ tenant: { organizationId: 'org-factory' }, checks: [{ name: 'config', status: 'pass' }] }),
          runSmoke: async () => createRuntimeReadinessReport({ tenant: { organizationId: 'org-factory' }, checks: [{ name: 'smoke', status: 'pass' }] }),
        },
        addressPool: {
          importAddresses: async () => [{ address: '0xabc' }],
          getSummary: async () => ({ totalAddresses: 1 }),
          listAddresses: async () => [{ address: '0xabc' }],
        },
        webhooks: {
          upsertEndpoint: async () => ({ id: 'wh-factory' }),
          createTestDelivery: async () => ({ endpointId: 'wh-factory' }),
        },
      } as never,
    });

    await expect(routes.orders.createOrder({ headers: { authorization: 'Bearer pk' }, body: { orderReference: 'o', amount: '1', currency: 'USDC', chainId: 'ethereum-sepolia' } })).resolves.toEqual({ status: 201, body: { data: { id: 'order-factory' } } });
    await expect(routes.paymentLinks.createPaymentLink({ headers: { authorization: 'Bearer pk' }, body: { title: 't', amount: '1', currency: 'USDC', chainOptions: ['ethereum-sepolia'] } })).resolves.toEqual({ status: 201, body: { data: { id: 'plink-factory' } } });
    await expect(routes.readiness?.runSmoke({ headers: { authorization: 'Bearer pk' }, body: undefined })).resolves.toMatchObject({ status: 200, body: { data: { status: 'pass' } } });
    await expect(routes.addressPool.getSummary({ headers: { authorization: 'Bearer pk' }, body: undefined })).resolves.toEqual({ status: 200, body: { data: { totalAddresses: 1 } } });
    await expect(routes.addressPool.listAddresses({ headers: { authorization: 'Bearer pk' }, query: { protocol: 'evm' }, body: undefined })).resolves.toEqual({ status: 200, body: { data: [{ address: '0xabc' }] } });
    await expect(routes.webhooks.createTestDelivery({ headers: { authorization: 'Bearer pk' }, params: { endpointId: 'wh-factory' }, body: {} })).resolves.toEqual({ status: 200, body: { data: { endpointId: 'wh-factory' } } });
  });
});
