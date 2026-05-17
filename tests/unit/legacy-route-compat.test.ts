import { describe, expect, it } from 'vitest';
import {
  CLOUD_LEGACY_ROUTE_COMPATIBILITY,
  normalizeHostedRuntimeConfig,
  toLegacyApiKeyCreateResponse,
  toLegacyApiKeyListResponse,
  toLegacyConfigResponse,
  toLegacyMemberResponse,
  toLegacyOrderListResponse,
  toLegacyOrderResponse,
  toLegacyOrganizationResponse,
  toLegacyPaymentLinkListResponse,
  toLegacyPaymentLinkResponse,
  toLegacyWebhookEndpointListResponse,
  toLegacyWebhookEndpointResponse,
} from '../../src/index.js';

describe('legacy Cloud route compatibility contracts', () => {
  it('documents old Cloud organization/API-key/member route shapes', () => {
    expect(CLOUD_LEGACY_ROUTE_COMPATIBILITY).toEqual([
      { method: 'POST', path: '/api/v1/organizations', responseEnvelope: 'organization' },
      { method: 'GET', path: '/api/v1/organizations', responseEnvelope: 'organizations' },
      { method: 'GET', path: '/api/v1/organizations/:organizationId', responseEnvelope: 'organization+role' },
      { method: 'POST', path: '/api/v1/organizations/:organizationId/api-keys', responseEnvelope: 'apiKey+metadata' },
      { method: 'GET', path: '/api/v1/organizations/:organizationId/api-keys', responseEnvelope: 'apiKeys' },
      { method: 'DELETE', path: '/api/v1/organizations/:organizationId/api-keys/:apiKeyId', responseEnvelope: 'empty' },
      { method: 'POST', path: '/api/v1/organizations/:organizationId/members', responseEnvelope: 'member' },
      { method: 'GET', path: '/api/v1/organizations/:organizationId/members', responseEnvelope: 'members' },
      { method: 'PATCH', path: '/api/v1/organizations/:organizationId/members/:userId', responseEnvelope: 'member' },
      { method: 'DELETE', path: '/api/v1/organizations/:organizationId/members/:userId', responseEnvelope: 'empty' },
      { method: 'POST', path: '/api/v1/orders', responseEnvelope: 'data' },
      { method: 'GET', path: '/api/v1/orders/:orderId', responseEnvelope: 'data' },
      { method: 'GET', path: '/api/v1/orders', responseEnvelope: 'data+pagination' },
      { method: 'POST', path: '/api/v1/payment-links', responseEnvelope: 'data' },
      { method: 'GET', path: '/api/v1/payment-links/:paymentLinkId', responseEnvelope: 'data' },
      { method: 'PUT', path: '/api/v1/payment-links/:paymentLinkId', responseEnvelope: 'data' },
      { method: 'POST', path: '/api/v1/payment-links/:paymentLinkId/publish', responseEnvelope: 'data' },
      { method: 'GET', path: '/api/v1/payment-links', responseEnvelope: 'data+pagination' },
      { method: 'GET', path: '/api/v1/config', responseEnvelope: 'config' },
      { method: 'GET', path: '/api/v1/config/:key', responseEnvelope: 'config' },
      { method: 'PUT', path: '/api/v1/config/:key', responseEnvelope: 'config' },
      { method: 'POST', path: '/api/v1/webhooks/endpoints', responseEnvelope: 'webhookEndpoint' },
      { method: 'GET', path: '/api/v1/webhooks/endpoints', responseEnvelope: 'webhookEndpoints' },
      { method: 'PUT', path: '/api/v1/webhooks/endpoints/:endpointId', responseEnvelope: 'webhookEndpoint' },
      { method: 'DELETE', path: '/api/v1/webhooks/endpoints/:endpointId', responseEnvelope: 'empty' },
    ]);
  });

  it('maps Cloud Layer organization data to old Cloud response envelopes', () => {
    const organization = { id: 'org-legacy', name: 'Legacy Org', slug: 'legacy-org', planType: 'pro' as const };

    expect(toLegacyOrganizationResponse({ organization })).toEqual({ organization });
    expect(toLegacyOrganizationResponse({ organization, role: 'admin' })).toEqual({ organization, role: 'admin' });
  });

  it('maps API key create/list responses to old Cloud envelopes', () => {
    const metadata = { id: 'key-legacy', keyPrefix: 'pk_live_', name: 'Legacy key', organizationId: 'org-legacy' };

    expect(toLegacyApiKeyCreateResponse({ presentedKey: 'pk_live_secret', apiKey: metadata })).toEqual({
      apiKey: 'pk_live_secret',
      metadata,
    });
    expect(toLegacyApiKeyListResponse([metadata])).toEqual({ apiKeys: [metadata] });
  });

  it('maps member responses to old Cloud envelopes', () => {
    const member = { organizationId: 'org-legacy', userId: 'user-legacy', role: 'member' as const, status: 'active' as const };

    expect(toLegacyMemberResponse(member)).toEqual({ member });
    expect(toLegacyMemberResponse([member])).toEqual({ members: [member] });
  });

  it('maps order responses to old Cloud data envelopes', () => {
    const order = { id: 'order-legacy', tenant: { organizationId: 'org-legacy', tenantId: 'org-legacy' }, orderReference: 'ref-legacy', amount: '10', currency: 'USDC', chainId: 'ethereum', status: 'pending' as const, confirmedReceived: '0' };
    const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };

    expect(toLegacyOrderResponse(order)).toEqual({ data: order });
    expect(toLegacyOrderListResponse([order], pagination)).toEqual({ data: [order], pagination });
  });

  it('maps payment link responses to old Cloud data envelopes', () => {
    const link = { id: 'plink-legacy', tenant: { organizationId: 'org-legacy', tenantId: 'org-legacy' }, title: 'Legacy link', amount: '25', currency: 'USDC', chainOptions: ['ethereum'], status: 'draft' as const, inventoryReserved: 0 };
    const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };

    expect(toLegacyPaymentLinkResponse(link)).toEqual({ data: link });
    expect(toLegacyPaymentLinkListResponse([link], pagination)).toEqual({ data: [link], pagination });
  });

  it('maps hosted config and webhook responses to old Cloud envelopes', () => {
    const config = normalizeHostedRuntimeConfig({ tenant: { organizationId: 'org-legacy', tenantId: 'org-legacy' }, apiBaseUrl: 'https://api.example', enabledChains: ['ethereum'], enabledTokens: ['USDC'], secretRefs: {}, limits: {}, metadata: {} });
    const endpoint = { id: 'wh-legacy', tenant: { organizationId: 'org-legacy', tenantId: 'org-legacy' }, url: 'https://merchant.example/webhook', eventTypes: ['order.completed'], signingSecretRef: 'secret://legacy', enabled: true };

    expect(toLegacyConfigResponse(config)).toEqual({ config });
    expect(toLegacyWebhookEndpointResponse(endpoint)).toEqual({ endpoint });
    expect(toLegacyWebhookEndpointListResponse([endpoint])).toEqual({ endpoints: [endpoint] });
  });
});
