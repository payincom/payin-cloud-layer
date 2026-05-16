import { describe, expect, it } from 'vitest';
import {
  createCloudOrderRouteHandlers,
  type CloudOrderService,
} from '../../src/index.js';

describe('Cloud order route harness', () => {
  it('maps HTTP create-order input to CloudOrderService without duplicating tenant logic', async () => {
    const calls: unknown[] = [];
    const service = {
      async createOrder(input: unknown) {
        calls.push(input);
        return { id: 'order-route-1', status: 'pending', tenant: { organizationId: 'org-route' } };
      },
    } as Pick<CloudOrderService, 'createOrder'>;
    const handlers = createCloudOrderRouteHandlers({ orders: service });

    const response = await handlers.createOrder({
      headers: { authorization: 'Bearer pk_live_route' },
      body: {
        orderReference: 'route-1',
        amount: '12.00',
        currency: 'USDC',
        chainId: 'ethereum-sepolia',
        metadata: { cartId: 'cart-1' },
      },
    });

    expect(calls).toEqual([
      {
        apiKey: 'pk_live_route',
        orderReference: 'route-1',
        amount: '12.00',
        currency: 'USDC',
        chainId: 'ethereum-sepolia',
        metadata: { cartId: 'cart-1' },
      },
    ]);
    expect(response).toEqual({ status: 201, body: { data: { id: 'order-route-1', status: 'pending', tenant: { organizationId: 'org-route' } } } });
  });

  it('normalizes service errors into route error responses', async () => {
    const handlers = createCloudOrderRouteHandlers({
      orders: { createOrder: async () => { throw new Error('Tenant is not entitled to capability: orders:create'); } } as Pick<CloudOrderService, 'createOrder'>,
    });

    await expect(handlers.createOrder({ headers: { authorization: 'Bearer pk_live_route' }, body: { orderReference: 'route-1', amount: '12.00', currency: 'USDC', chainId: 'ethereum-sepolia' } })).resolves.toEqual({
      status: 403,
      body: { error: { code: 'CLOUD_ROUTE_FORBIDDEN', message: 'Tenant is not entitled to capability: orders:create' } },
    });
  });

  it('requires bearer API key at the route edge', async () => {
    const handlers = createCloudOrderRouteHandlers({
      orders: { createOrder: async () => ({ id: 'unused', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, orderReference: 'unused', amount: '1', currency: 'USDC', chainId: 'ethereum-sepolia', status: 'pending', confirmedReceived: '0' }) } as Pick<CloudOrderService, 'createOrder'>,
    });

    await expect(handlers.createOrder({ headers: {}, body: {} as never })).resolves.toEqual({
      status: 401,
      body: { error: { code: 'CLOUD_ROUTE_UNAUTHORIZED', message: 'Bearer API key is required' } },
    });
  });
});
