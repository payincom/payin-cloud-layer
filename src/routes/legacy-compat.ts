import type { CloudApiKey } from '../api-key.js';
import type { CloudOrder } from '../orders.js';
import type { CloudOrganization, CloudOrganizationMember, CloudOrganizationRole } from '../organization.js';
import type { CloudPaymentLink } from '../payment-links.js';
import type { HostedRuntimeConfig } from '../hosted-config.js';
import type { CloudWebhookEndpoint } from '../webhooks.js';

export type LegacyCloudHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type LegacyCloudResponseEnvelope = 'data' | 'data+pagination' | 'organization' | 'organizations' | 'organization+role' | 'apiKey+metadata' | 'apiKeys' | 'member' | 'members' | 'config' | 'webhookEndpoint' | 'webhookEndpoints' | 'empty';

export interface LegacyPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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

export function toLegacyDataResponse<T>(data: T): { data: T } {
  return { data };
}

export function toLegacyPaginatedDataResponse<T>(data: T[], pagination: LegacyPagination): { data: T[]; pagination: LegacyPagination } {
  return { data, pagination };
}

export function toLegacyOrderResponse(order: CloudOrder): { data: CloudOrder } {
  return toLegacyDataResponse(order);
}

export function toLegacyOrderListResponse(orders: CloudOrder[], pagination: LegacyPagination): { data: CloudOrder[]; pagination: LegacyPagination } {
  return toLegacyPaginatedDataResponse(orders, pagination);
}

export function toLegacyPaymentLinkResponse(link: CloudPaymentLink): { data: CloudPaymentLink } {
  return toLegacyDataResponse(link);
}

export function toLegacyPaymentLinkListResponse(links: CloudPaymentLink[], pagination: LegacyPagination): { data: CloudPaymentLink[]; pagination: LegacyPagination } {
  return toLegacyPaginatedDataResponse(links, pagination);
}

export function toLegacyConfigResponse(config: HostedRuntimeConfig): { config: HostedRuntimeConfig } {
  return { config };
}

export function toLegacyWebhookEndpointResponse(endpoint: CloudWebhookEndpoint): { endpoint: CloudWebhookEndpoint } {
  return { endpoint };
}

export function toLegacyWebhookEndpointListResponse(endpoints: CloudWebhookEndpoint[]): { endpoints: CloudWebhookEndpoint[] } {
  return { endpoints };
}

export function toLegacyEmptyResponse(): Record<string, never> {
  return {};
}
