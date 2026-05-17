import type { CloudApiKey } from '../api-key.js';
import type { CloudOrganization, CloudOrganizationMember, CloudOrganizationRole } from '../organization.js';

export type LegacyCloudHttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type LegacyCloudResponseEnvelope = 'organization' | 'organizations' | 'organization+role' | 'apiKey+metadata' | 'apiKeys' | 'member' | 'members' | 'empty';

export interface LegacyCloudRouteCompatibilityEntry {
  method: LegacyCloudHttpMethod;
  path: string;
  responseEnvelope: LegacyCloudResponseEnvelope;
}

export const CLOUD_LEGACY_ROUTE_COMPATIBILITY: readonly LegacyCloudRouteCompatibilityEntry[] = [
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
];

export function toLegacyOrganizationResponse(input: { organization: CloudOrganization; role?: CloudOrganizationRole }): { organization: CloudOrganization; role?: CloudOrganizationRole } {
  return input.role ? { organization: input.organization, role: input.role } : { organization: input.organization };
}

export function toLegacyOrganizationListResponse(organizations: Array<CloudOrganization & { role?: CloudOrganizationRole }>): { organizations: Array<CloudOrganization & { role?: CloudOrganizationRole }> } {
  return { organizations };
}

export function toLegacyApiKeyCreateResponse(input: { presentedKey: string; apiKey: CloudApiKey }): { apiKey: string; metadata: CloudApiKey } {
  return { apiKey: input.presentedKey, metadata: input.apiKey };
}

export function toLegacyApiKeyListResponse(apiKeys: CloudApiKey[]): { apiKeys: CloudApiKey[] } {
  return { apiKeys };
}

export function toLegacyMemberResponse(member: CloudOrganizationMember): { member: CloudOrganizationMember };
export function toLegacyMemberResponse(members: CloudOrganizationMember[]): { members: CloudOrganizationMember[] };
export function toLegacyMemberResponse(input: CloudOrganizationMember | CloudOrganizationMember[]): { member?: CloudOrganizationMember; members?: CloudOrganizationMember[] } {
  return Array.isArray(input) ? { members: input } : { member: input };
}

export function toLegacyEmptyResponse(): Record<string, never> {
  return {};
}
