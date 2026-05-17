import { describe, expect, it } from 'vitest';
import {
  CLOUD_LEGACY_ROUTE_COMPATIBILITY,
  toLegacyApiKeyCreateResponse,
  toLegacyApiKeyListResponse,
  toLegacyMemberResponse,
  toLegacyOrganizationResponse,
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
});
