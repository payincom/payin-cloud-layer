import { describe, expect, it } from 'vitest';
import {
  CloudPaymentLinkInventoryError,
  CloudPaymentLinkStateError,
  createPaymentLinkOrderDraft,
  createPublicPaymentLinkView,
  normalizeCloudPaymentLink,
  publishCloudPaymentLink,
  reservePaymentLinkInventory,
  type CloudPaymentLink,
} from '../../src/index.js';

const tenant = { organizationId: 'org-plink', tenantId: 'org-plink' };

function draft(overrides: Partial<CloudPaymentLink> = {}): CloudPaymentLink {
  return normalizeCloudPaymentLink({
    id: 'plink-1',
    tenant,
    title: 'Hosted checkout',
    description: 'Test link',
    amount: '25.50',
    currency: 'USDC',
    chainOptions: ['ethereum-sepolia'],
    status: 'draft',
    inventoryTotal: 2,
    inventoryReserved: 0,
    ...overrides,
  });
}

describe('Cloud payment link contract', () => {
  it('normalizes tenant context and rejects invalid monetary/link inputs', () => {
    expect(draft()).toMatchObject({
      tenant,
      amount: '25.50',
      currency: 'USDC',
      status: 'draft',
      inventoryTotal: 2,
      inventoryReserved: 0,
    });

    expect(() => draft({ amount: '-1' })).toThrow('Payment link amount must be a positive decimal string');
    expect(() => draft({ currency: 'usd!' })).toThrow('Payment link currency must be an uppercase symbol');
    expect(() => draft({ chainOptions: [] })).toThrow('Payment link requires at least one chain option');
    expect(() => draft({ inventoryTotal: -1 })).toThrow('inventoryTotal must be a non-negative integer');
  });

  it('publishes draft links with deterministic slugs while keeping adapter ownership of uniqueness', () => {
    expect(publishCloudPaymentLink(draft(), { slug: 'hosted-checkout' })).toMatchObject({
      status: 'published',
      slug: 'hosted-checkout',
      slugUniqueness: 'adapter-owned',
    });

    expect(() => publishCloudPaymentLink(draft({ status: 'archived' }), { slug: 'archived-link' })).toThrow(
      CloudPaymentLinkStateError
    );
    expect(() => publishCloudPaymentLink(draft(), { slug: 'Invalid Slug!' })).toThrow(
      'Payment link slug must use lowercase letters, numbers, and hyphens'
    );
  });

  it('creates a public checkout view that hides tenant/internal fields', () => {
    const published = publishCloudPaymentLink(draft({ metadata: { internal: true } }), { slug: 'hosted-checkout' });

    expect(createPublicPaymentLinkView(published)).toEqual({
      id: 'plink-1',
      slug: 'hosted-checkout',
      title: 'Hosted checkout',
      description: 'Test link',
      amount: '25.50',
      currency: 'USDC',
      chainOptions: ['ethereum-sepolia'],
      availableInventory: 2,
      status: 'published',
    });
    expect(JSON.stringify(createPublicPaymentLinkView(published))).not.toContain('org-plink');
  });

  it('reserves inventory without over-reserving', () => {
    const published = publishCloudPaymentLink(draft(), { slug: 'hosted-checkout' });

    const reserved = reservePaymentLinkInventory(published, 1);
    expect(reserved.inventoryReserved).toBe(1);
    expect(createPublicPaymentLinkView(reserved).availableInventory).toBe(1);

    expect(() => reservePaymentLinkInventory(reserved, 2)).toThrow(CloudPaymentLinkInventoryError);
  });

  it('treats null inventoryTotal as unlimited inventory', () => {
    const published = publishCloudPaymentLink(draft({ inventoryTotal: null, inventoryReserved: 0 }), { slug: 'unlimited' });

    const reserved = reservePaymentLinkInventory(published, 500);
    expect(reserved.inventoryReserved).toBe(500);
    expect(createPublicPaymentLinkView(reserved).availableInventory).toBeNull();
  });

  it('creates payment-link order drafts that inherit tenant and validate public checkout state', () => {
    const published = publishCloudPaymentLink(draft(), { slug: 'hosted-checkout' });

    expect(createPaymentLinkOrderDraft(published, {
      buyerEmail: ' Buyer@Example.COM ',
      chainId: 'ethereum-sepolia',
    })).toMatchObject({
      tenant,
      paymentLinkId: 'plink-1',
      buyerEmail: 'buyer@example.com',
      chainId: 'ethereum-sepolia',
      amount: '25.50',
      currency: 'USDC',
      status: 'pending',
    });

    expect(() => createPaymentLinkOrderDraft(draft(), { buyerEmail: 'buyer@example.com', chainId: 'ethereum-sepolia' }))
      .toThrow('Payment link must be published before checkout');
    expect(() => createPaymentLinkOrderDraft(published, { buyerEmail: 'bad', chainId: 'ethereum-sepolia' }))
      .toThrow('Buyer email must be valid');
    expect(() => createPaymentLinkOrderDraft(published, { buyerEmail: 'buyer@example.com', chainId: 'base-sepolia' }))
      .toThrow('Requested chain is not enabled for this payment link');
  });
});
