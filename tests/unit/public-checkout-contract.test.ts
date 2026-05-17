import { describe, expect, it } from 'vitest';
import {
  createPublicOrderStatusView,
  createPublicPaymentLinkCheckoutView,
  createPublicDepositStatusView,
  createPublicRuntimeDiscoveryView,
  renderPublicDepositStatusHtml,
  renderPublicOrderStatusHtml,
  renderPublicPaymentLinkCheckoutHtml,
  toLegacyPublicOrderStatusResponse,
} from '../../src/index.js';

const tenant = { organizationId: 'org-public', tenantId: 'org-public', plan: 'pro' as const };

describe('public checkout contracts', () => {
  it('builds old Cloud-compatible public order status payloads', () => {
    const status = createPublicOrderStatusView({
      order: {
        id: 'order-public',
        tenant,
        orderReference: 'ref-public',
        amount: '10.00',
        currency: 'USDC',
        chainId: 'ethereum-sepolia',
        status: 'pending',
        paymentAddress: '0x1111111111111111111111111111111111111111',
        confirmedReceived: '4.00',
        createdAt: new Date('2026-05-17T05:30:00.000Z'),
      },
      requiredConfirmations: 2,
      transfers: [{ transactionHash: '0xtx', status: 'detected', detectedBlockNumber: 100 }],
    });

    expect(status).toMatchObject({
      orderId: 'order-public',
      orderReference: 'ref-public',
      status: 'pending',
      amount: '10.00',
      token: 'USDC',
      chain: 'ethereum-sepolia',
      address: '0x1111111111111111111111111111111111111111',
      requiredConfirmations: 2,
      currentConfirmations: 1,
      transactionHash: '0xtx',
      transferStatus: 'detected',
      confirmedReceived: '4.00',
      requiredAmount: '10.00',
      receivedAmount: '4.00',
      remainingAmount: '6.00',
      paymentProgress: 40,
      isPartiallyPaid: true,
      isFullyPaid: false,
      transferCount: 1,
      redirectUrl: null,
    });
    expect(toLegacyPublicOrderStatusResponse(status)).toEqual({ success: true, data: status });
  });

  it('calculates confirmations for confirmed transfers', () => {
    const status = createPublicOrderStatusView({
      order: { id: 'order-confirmed', tenant, orderReference: 'ref-confirmed', amount: '10.00', currency: 'USDC', chainId: 'ethereum-sepolia', status: 'completed', confirmedReceived: '10.00' },
      transfers: [{ transactionHash: '0xtx2', status: 'confirmed', detectedBlockNumber: 100, confirmedBlockNumber: 103, confirmedAt: new Date('2026-05-17T05:31:00.000Z') }],
      redirectUrl: 'https://merchant.example/thanks',
    });

    expect(status).toMatchObject({ currentConfirmations: 4, isFullyPaid: true, paymentProgress: 100, redirectUrl: 'https://merchant.example/thanks' });
  });

  it('builds public payment-link checkout data without depending on old SSR runtime', () => {
    const checkout = createPublicPaymentLinkCheckoutView({
      id: 'plink-public',
      tenant,
      title: 'Public checkout',
      description: 'Hosted checkout page',
      amount: '25.50',
      currency: 'USDC',
      chainOptions: ['ethereum-sepolia'],
      status: 'published',
      slug: 'public-checkout',
      inventoryTotal: 10,
      inventoryReserved: 3,
    }, {
      requestOrigin: 'https://pay.example/',
    });

    expect(checkout).toEqual({
      id: 'plink-public',
      slug: 'public-checkout',
      title: 'Public checkout',
      description: 'Hosted checkout page',
      amount: '25.50',
      currency: 'USDC',
      chainOptions: ['ethereum-sepolia'],
      availableInventory: 7,
      status: 'published',
      requestOrigin: 'https://pay.example',
      apiBaseUrl: 'https://pay.example',
      orderBaseUrl: 'https://pay.example/pay/order',
      shareUrl: 'https://pay.example/checkout/public-checkout',
    });
  });

  it('renders standalone public checkout HTML shells with embedded JSON data', () => {
    const checkout = createPublicPaymentLinkCheckoutView({
      id: 'plink-html',
      tenant,
      title: 'HTML checkout',
      description: 'Hosted checkout page',
      amount: '12.00',
      currency: 'USDC',
      chainOptions: ['ethereum-sepolia'],
      status: 'published',
      slug: 'html-checkout',
    }, { requestOrigin: 'https://pay.example' });

    expect(renderPublicPaymentLinkCheckoutHtml(checkout)).toContain('<!doctype html>');
    expect(renderPublicPaymentLinkCheckoutHtml(checkout)).toContain('id="payin-checkout-data"');
    expect(renderPublicPaymentLinkCheckoutHtml(checkout)).toContain('HTML checkout');

    const status = createPublicOrderStatusView({
      order: { id: 'order-html', tenant, orderReference: 'ref-html', amount: '12.00', currency: 'USDC', chainId: 'ethereum-sepolia', status: 'pending', confirmedReceived: '0' },
    });
    expect(renderPublicOrderStatusHtml(status)).toContain('<!doctype html>');
    expect(renderPublicOrderStatusHtml(status)).toContain('id="payin-order-status-data"');
    expect(renderPublicOrderStatusHtml(status)).toContain('ref-html');
  });

  it('builds and renders public deposit status views', () => {
    const deposit = createPublicDepositStatusView({
      tenant,
      address: '0x2222222222222222222222222222222222222222',
      protocol: 'evm',
      state: 'bound',
      depositReference: 'dep-html',
      orderId: 'order-html',
    }, { requestOrigin: 'https://pay.example/' });

    expect(deposit).toMatchObject({
      address: '0x2222222222222222222222222222222222222222',
      protocol: 'evm',
      state: 'bound',
      depositReference: 'dep-html',
      paymentUrl: 'https://pay.example/pay/deposit/0x2222222222222222222222222222222222222222',
    });
    expect(renderPublicDepositStatusHtml(deposit)).toContain('id="payin-deposit-status-data"');
  });

  it('builds public chain and token discovery views', () => {
    expect(createPublicRuntimeDiscoveryView({ chains: ['ethereum-sepolia'], tokens: ['USDC'] })).toEqual({
      chains: [{ id: 'ethereum-sepolia', name: 'Ethereum Sepolia', status: 'enabled' }],
      tokens: [{ symbol: 'USDC', status: 'enabled' }],
    });
  });
});
