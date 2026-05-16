import { describe, expect, it, vi } from 'vitest';
import { CloudProcessor } from '../../src/cloud-processor.js';

function createFakeProcessor() {
  return {
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    getEventBus: vi.fn(() => ({ subscribe: vi.fn() })),
    createOrder: vi.fn(async (request) => ({ id: 'order-id', ...request })),
    getOrder: vi.fn(async () => ({ id: 'order-id' })),
    bindDepositAddress: vi.fn(async (request) => ({ address: '0xabc', ...request })),
    unbindDepositAddress: vi.fn(async () => undefined),
    getUserDepositAddress: vi.fn(async () => ({ address: '0xabc' })),
    listAddresses: vi.fn(async () => ({ addresses: [], total: 0 })),
    getAddressPoolAvailability: vi.fn(async () => ({ total: 0, available: 0, allocated: 0, bound: 0, coolingDown: 0, archived: 0 })),
    addAddressesToPool: vi.fn(async () => undefined),
    getTransfers: vi.fn(async () => []),
    getTransferByTxHash: vi.fn(async () => null),
    listOrders: vi.fn(async () => ({ orders: [], total: 0, page: 1, limit: 20 })),
    listTransfers: vi.fn(async () => ({ transfers: [], total: 0, page: 1, limit: 20 })),
  } as any;
}

describe('CloudProcessor', () => {
  it('requires an explicit tenant organization id', () => {
    expect(() => new CloudProcessor(createFakeProcessor(), { organizationId: '   ' })).toThrow(
      'Cloud tenant context with organizationId is required'
    );
  });

  it('keeps explicit tenant scope at the Cloud layer boundary', () => {
    const fake = createFakeProcessor();
    const cloud = new CloudProcessor(fake, {
      organizationId: '22222222-2222-2222-2222-222222222222',
      organizationLabel: 'Cloud tenant',
    });

    expect(cloud.paymentScope).toEqual({
      id: '22222222-2222-2222-2222-222222222222',
      kind: 'tenant',
      label: 'Cloud tenant',
    });
  });

  it('injects tenant organization id into shared processor calls', async () => {
    const fake = createFakeProcessor();
    const cloud = new CloudProcessor(fake, { organizationId: '22222222-2222-2222-2222-222222222222' });

    await cloud.createOrder({ orderReference: 'cloud-order-1', amount: '10', currency: 'USDC', chainId: 'ethereum-sepolia' });
    await cloud.bindDepositAddress({ depositReference: 'customer-1', protocol: 'evm' });
    await cloud.getTransfers({ orderId: 'order-id' });
    await cloud.getTransferByTxHash('0xtx');
    await cloud.listOrders({ status: 'pending' });

    expect(fake.createOrder).toHaveBeenCalledWith({
      orderReference: 'cloud-order-1',
      amount: '10',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      organizationId: '22222222-2222-2222-2222-222222222222',
    });
    expect(fake.bindDepositAddress).toHaveBeenCalledWith({
      depositReference: 'customer-1',
      protocol: 'evm',
      organizationId: '22222222-2222-2222-2222-222222222222',
    });
    expect(fake.getTransfers).toHaveBeenCalledWith({ orderId: 'order-id' }, '22222222-2222-2222-2222-222222222222');
    expect(fake.getTransferByTxHash).toHaveBeenCalledWith('0xtx', '22222222-2222-2222-2222-222222222222');
    expect(fake.listOrders).toHaveBeenCalledWith({ status: 'pending', organizationId: '22222222-2222-2222-2222-222222222222' });
  });
});
