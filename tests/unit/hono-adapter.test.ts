import { describe, expect, it } from 'vitest';
import { createCloudHonoApp, createPublicDepositStatusView, createPublicOrderStatusView, createPublicPaymentLinkCheckoutView, createRuntimeReadinessReport } from '../../src/index.js';


async function responseJson(response: Response | Promise<Response>): Promise<unknown> {
  return (await response).json();
}

async function responseStatus(response: Response | Promise<Response>): Promise<number> {
  return (await response).status;
}

function jsonRequest(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { authorization: 'Bearer pk_hono', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

describe('Cloud Hono adapter', () => {
  it('binds framework-neutral route harnesses to old Cloud /api/v1 HTTP paths', async () => {
    const calls: unknown[] = [];
    const app = createCloudHonoApp({
      legacyEnvelopes: true,
      services: {
        orders: {
          createOrder: async (input: unknown) => { calls.push(['createOrder', input]); return { id: 'order-hono' }; },
          getOrder: async (input: unknown) => { calls.push(['getOrder', input]); return { id: 'order-hono' }; },
          listOrders: async (input: unknown) => { calls.push(['listOrders', input]); return [{ id: 'order-hono' }]; },
        },
        paymentLinks: {
          createPaymentLink: async () => ({ id: 'plink-hono' }),
          getPaymentLink: async () => ({ id: 'plink-hono' }),
          listPaymentLinks: async () => [{ id: 'plink-hono' }],
          publishPaymentLink: async () => ({ id: 'plink-hono', status: 'published' }),
        },
        addressPool: {
          importAddresses: async () => [{ address: '0xabc', protocol: 'evm', state: 'idle' }],
          getSummary: async () => ({ totalAddresses: 1 }),
          listAddresses: async (input: unknown) => { calls.push(['listAddresses', input]); return [{ address: '0xabc', protocol: 'evm', state: 'idle' }]; },
        },
        webhooks: {
          upsertEndpoint: async (input: unknown) => { calls.push(['upsertEndpoint', input]); return { id: 'wh-hono' }; },
          createTestDelivery: async () => ({ endpointId: 'wh-hono' }),
        },
        apiKeys: {
          createApiKey: async () => ({ presentedKey: 'pk_created', apiKey: { id: 'key-hono' } }),
          listApiKeys: async () => [{ id: 'key-hono' }],
          revokeApiKey: async () => ({ id: 'key-hono', revokedAt: new Date('2026-05-17T06:20:00.000Z') }),
        },
        configs: {
          getConfig: async () => ({ tenant: { organizationId: 'org-hono' }, enabledChains: [], enabledTokens: [], limits: {}, isChainEnabled: () => false, isTokenEnabled: () => false }),
          updateConfig: async () => ({ tenant: { organizationId: 'org-hono' }, enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'], limits: {}, isChainEnabled: () => true, isTokenEnabled: () => true }),
        },
        readiness: {
          getReadiness: async () => createRuntimeReadinessReport({ tenant: { organizationId: 'org-hono' }, checks: [{ name: 'config', status: 'pass' }] }),
          runSmoke: async () => createRuntimeReadinessReport({ tenant: { organizationId: 'org-hono' }, checks: [{ name: 'smoke', status: 'pass' }] }),
        },
      } as never,
    });

    await expect(responseJson(app.request('/api/v1/orders', jsonRequest('POST', { orderReference: 'ref', amount: '1', currency: 'USDC', chainId: 'ethereum-sepolia' })))).resolves.toEqual({ data: { id: 'order-hono' } });
    await expect(responseJson(app.request('/api/v1/orders?status=pending', { headers: { authorization: 'Bearer pk_hono' } }))).resolves.toEqual({ data: [{ id: 'order-hono' }], pagination: { page: 1, limit: 1, total: 1, totalPages: 1 } });
    await expect(responseJson(app.request('/api/v1/organizations/org-hono/api-keys', jsonRequest('POST', { name: 'Hono' })))).resolves.toEqual({ apiKey: 'pk_created', metadata: { id: 'key-hono' } });
    await expect(responseJson(app.request('/api/v1/config', { headers: { authorization: 'Bearer pk_hono' } }))).resolves.toMatchObject({ config: { tenant: { organizationId: 'org-hono' } } });
    await expect(responseJson(app.request('/api/v1/address-pool/addresses?protocol=evm', { headers: { authorization: 'Bearer pk_hono' } }))).resolves.toEqual({ data: [{ address: '0xabc', protocol: 'evm', state: 'idle' }] });
    await expect(responseJson(app.request('/api/v1/webhooks/endpoints', jsonRequest('POST', { id: 'wh-hono', url: 'https://merchant.example/webhook', eventTypes: ['order.created'], signingSecretRef: 'secret://wh', enabled: true })))).resolves.toEqual({ endpoint: { id: 'wh-hono' } });
    await expect(responseStatus(app.request('/api/v1/smoke', jsonRequest('POST')))).resolves.toBe(200);

    expect(calls).toContainEqual(['listOrders', { apiKey: 'pk_hono', status: 'pending' }]);
    expect(calls).toContainEqual(['listAddresses', { apiKey: 'pk_hono', protocol: 'evm', state: undefined }]);
    expect(calls).toContainEqual(['upsertEndpoint', { apiKey: 'pk_hono', id: 'wh-hono', url: 'https://merchant.example/webhook', eventTypes: ['order.created'], signingSecretRef: 'secret://wh', enabled: true, metadata: undefined }]);
  });

  it('binds public checkout and order-status contracts to HTTP paths', async () => {
    const app = createCloudHonoApp({
      services: {
        orders: { createOrder: async () => ({ id: 'unused' }), getOrder: async () => ({ id: 'unused' }), listOrders: async () => [] },
        paymentLinks: { createPaymentLink: async () => ({}), getPaymentLink: async () => ({}), listPaymentLinks: async () => [], publishPaymentLink: async () => ({}) },
        addressPool: { importAddresses: async () => [], getSummary: async () => ({}), listAddresses: async () => [] },
        webhooks: { upsertEndpoint: async () => ({}), createTestDelivery: async () => ({}) },
      } as never,
      publicCheckout: {
        getOrderStatus: async ({ orderId }) => orderId === 'order-public'
          ? createPublicOrderStatusView({ order: { id: 'order-public', tenant: { organizationId: 'org-public' }, orderReference: 'ref', amount: '10', currency: 'USDC', chainId: 'ethereum-sepolia', status: 'pending', confirmedReceived: '0' } })
          : null,
        getPaymentLinkCheckout: async ({ slug, requestOrigin }) => slug === 'public-checkout'
          ? createPublicPaymentLinkCheckoutView({ id: 'plink-public', tenant: { organizationId: 'org-public' }, title: 'Public', amount: '10', currency: 'USDC', chainOptions: ['ethereum-sepolia'], status: 'published', slug }, { requestOrigin })
          : null,
        createPaymentLinkOrder: async ({ slug }) => slug === 'public-checkout'
          ? createPublicOrderStatusView({ order: { id: 'order-from-link', tenant: { organizationId: 'org-public' }, orderReference: 'ref-from-link', amount: '10', currency: 'USDC', chainId: 'ethereum-sepolia', status: 'pending', confirmedReceived: '0' } })
          : null,
        getPaymentLinkPreview: async ({ paymentLinkId, token, requestOrigin }) => paymentLinkId === 'plink-public' && token === 'preview-token'
          ? createPublicPaymentLinkCheckoutView({ id: 'plink-public', tenant: { organizationId: 'org-public' }, title: 'Preview', amount: '10', currency: 'USDC', chainOptions: ['ethereum-sepolia'], status: 'draft', slug: 'preview-checkout' }, { requestOrigin })
          : null,
        getDepositStatus: async ({ address, requestOrigin }) => address === '0xdeposit'
          ? createPublicDepositStatusView({ tenant: { organizationId: 'org-public' }, address, protocol: 'evm', state: 'bound', depositReference: 'dep-public' }, { requestOrigin })
          : null,
      },
    });

    await expect(responseJson(app.request('https://pay.example/api/payment-links/public-checkout'))).resolves.toMatchObject({ success: true, data: { id: 'plink-public', slug: 'public-checkout' } });
    const checkoutOrder = await app.request('https://pay.example/api/payment-links/public-checkout/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ buyerEmail: 'buyer@example.com', chainId: 'ethereum-sepolia' }) });
    expect(checkoutOrder.status).toBe(201);
    await expect(checkoutOrder.json()).resolves.toMatchObject({ success: true, data: { orderId: 'order-from-link' }, orderUrl: 'https://pay.example/pay/order/order-from-link' });
    await expect(responseJson(app.request('https://pay.example/api/order-status/order-public'))).resolves.toMatchObject({ success: true, data: { orderId: 'order-public', status: 'pending' } });
    await expect(responseJson(app.request('https://pay.example/checkout/public-checkout'))).resolves.toMatchObject({ success: true, data: { id: 'plink-public', shareUrl: 'https://pay.example/checkout/public-checkout' } });
    const checkoutHtml = await app.request('https://pay.example/checkout/public-checkout', { headers: { accept: 'text/html' } });
    expect(checkoutHtml.headers.get('content-type')).toContain('text/html');
    await expect(checkoutHtml.text()).resolves.toContain('id="payin-checkout-data"');
    const orderHtml = await app.request('https://pay.example/pay/order/order-public', { headers: { accept: 'text/html' } });
    expect(orderHtml.headers.get('content-type')).toContain('text/html');
    await expect(orderHtml.text()).resolves.toContain('id="payin-order-status-data"');
    const previewHtml = await app.request('https://pay.example/checkout/preview/plink-public?token=preview-token&viewport=mobile', { headers: { accept: 'text/html' } });
    expect(previewHtml.status).toBe(200);
    await expect(previewHtml.text()).resolves.toContain('id="payin-checkout-data"');
    const depositHtml = await app.request('https://pay.example/pay/deposit/0xdeposit', { headers: { accept: 'text/html' } });
    expect(depositHtml.status).toBe(200);
    await expect(depositHtml.text()).resolves.toContain('id="payin-deposit-status-data"');
    await expect(responseStatus(app.request('https://pay.example/checkout/missing'))).resolves.toBe(404);
  });

  it('returns route errors through HTTP status codes', async () => {
    const app = createCloudHonoApp({
      services: {
        orders: { createOrder: async () => ({ id: 'unused' }), getOrder: async () => ({ id: 'unused' }), listOrders: async () => [] },
        paymentLinks: { createPaymentLink: async () => ({}), getPaymentLink: async () => ({}), listPaymentLinks: async () => [], publishPaymentLink: async () => ({}) },
        addressPool: { importAddresses: async () => [], getSummary: async () => ({}), listAddresses: async () => [] },
        webhooks: { upsertEndpoint: async () => ({}), createTestDelivery: async () => ({}) },
      } as never,
    });

    const response = await app.request('/api/v1/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    await expect(response.json()).resolves.toEqual({ error: { code: 'CLOUD_ROUTE_UNAUTHORIZED', message: 'Bearer API key is required' } });
    expect(response.status).toBe(401);
  });
});
