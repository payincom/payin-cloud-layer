import { describe, expect, it } from 'vitest';
import {
  CloudOrderStateError,
  createCloudOrderDraft,
  createCloudOrderStatusSummary,
  createCloudPaymentPageUrl,
  markCloudOrderCompleted,
  normalizeCloudOrder,
  type CloudOrder,
} from '../../src/index.js';

const tenant = { organizationId: 'org-order', tenantId: 'org-order' };

function order(overrides: Partial<CloudOrder> = {}): CloudOrder {
  return normalizeCloudOrder({
    id: 'order-1',
    tenant,
    orderReference: 'merchant-order-1',
    amount: '10.00',
    currency: 'USDC',
    chainId: 'ethereum-sepolia',
    status: 'pending',
    paymentAddress: '0x1111111111111111111111111111111111111111',
    confirmedReceived: '0',
    ...overrides,
  });
}

describe('Cloud order contract', () => {
  it('creates tenant-scoped order drafts with validated money and chain inputs', () => {
    expect(createCloudOrderDraft({
      tenant,
      orderReference: ' order-123 ',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      metadata: { source: 'api' },
    })).toMatchObject({
      tenant,
      orderReference: 'order-123',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      status: 'pending',
    });

    expect(() => createCloudOrderDraft({ tenant, orderReference: 'x', amount: '0', currency: 'USDC', chainId: 'ethereum-sepolia' }))
      .toThrow('Order amount must be a positive decimal string');
    expect(() => createCloudOrderDraft({ tenant, orderReference: 'x', amount: '1', currency: 'usd!', chainId: 'ethereum-sepolia' }))
      .toThrow('Order currency must be an uppercase symbol');
    expect(() => createCloudOrderDraft({ tenant, orderReference: 'x', amount: '1', currency: 'USDC', chainId: ' ' }))
      .toThrow('chainId is required');
  });

  it('normalizes persisted orders and rejects tenantless orders', () => {
    expect(order()).toMatchObject({ tenant, status: 'pending', confirmedReceived: '0' });
    expect(() => normalizeCloudOrder({ ...order(), tenant: { organizationId: ' ' } })).toThrow(
      'Cloud tenant context with organizationId is required'
    );
  });

  it('derives public payment URLs without exposing tenant ids', () => {
    expect(createCloudPaymentPageUrl(order(), 'https://pay.payin.com')).toBe('https://pay.payin.com/pay/order/order-1');
    expect(createCloudPaymentPageUrl(order(), 'https://pay.payin.com/')).toBe('https://pay.payin.com/pay/order/order-1');
  });

  it('creates public status summaries with payment progress but no tenant internals', () => {
    expect(createCloudOrderStatusSummary(order({ confirmedReceived: '4.50' }))).toEqual({
      id: 'order-1',
      orderReference: 'merchant-order-1',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      status: 'pending',
      paymentAddress: '0x1111111111111111111111111111111111111111',
      confirmedReceived: '4.50',
      remainingAmount: '5.50',
    });
    expect(JSON.stringify(createCloudOrderStatusSummary(order()))).not.toContain('org-order');
  });

  it('marks pending orders completed when enough value is confirmed', () => {
    expect(markCloudOrderCompleted(order(), { confirmedReceived: '10.00', txHash: '0xabc' })).toMatchObject({
      status: 'completed',
      confirmedReceived: '10.00',
      completionTxHash: '0xabc',
    });

    expect(() => markCloudOrderCompleted(order({ status: 'expired' }), { confirmedReceived: '10.00' })).toThrow(CloudOrderStateError);
    expect(() => markCloudOrderCompleted(order(), { confirmedReceived: '9.99' })).toThrow('Confirmed amount is below order amount');
  });
});
