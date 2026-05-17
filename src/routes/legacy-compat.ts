import type { CloudApiKey } from '../api-key.js';
import type { CloudOrder } from '../orders.js';
import type { CloudOrganization, CloudOrganizationMember, CloudOrganizationRole } from '../organization.js';
import type { CloudPaymentLink } from '../payment-links.js';
import type { HostedRuntimeConfig } from '../hosted-config.js';
import type { CloudWebhookEndpoint } from '../webhooks.js';
import type { CloudRouteErrorBody, CloudRouteResponse } from './http.js';

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

const DEFAULT_LEGACY_PAGINATION: LegacyPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };

export interface LegacyCloudRouteResponseOptions {
  pagination?: LegacyPagination;
}

export function toLegacyCloudRouteResponse(response: CloudRouteResponse, envelope: LegacyCloudResponseEnvelope, options: LegacyCloudRouteResponseOptions = {}): CloudRouteResponse {
  if ('error' in (response.body as CloudRouteErrorBody | Record<string, unknown>)) return response;

  const data = extractRouteData(response.body);
  const pagination = options.pagination ?? inferLegacyPagination(data);

  switch (envelope) {
    case 'data':
      return { ...response, body: toLegacyDataResponse(data) };
    case 'data+pagination':
      return { ...response, body: toLegacyPaginatedDataResponse(Array.isArray(data) ? data : [data], pagination) };
    case 'organization':
    case 'organization+role':
      return { ...response, body: toLegacyOrganizationResponse(normalizeLegacyOrganizationPayload(data)) };
    case 'organizations':
      return { ...response, body: toLegacyOrganizationListResponse(Array.isArray(data) ? data : [data]) };
    case 'apiKey+metadata':
      return { ...response, body: toLegacyApiKeyCreateResponse(data as { presentedKey: string; apiKey: CloudApiKey }) };
    case 'apiKeys':
      return { ...response, body: toLegacyApiKeyListResponse(Array.isArray(data) ? data : [data]) };
    case 'member':
      return { ...response, body: toLegacyMemberResponse(data as CloudOrganizationMember) };
    case 'members':
      return { ...response, body: toLegacyMemberResponse(Array.isArray(data) ? data : [data]) };
    case 'config':
      return { ...response, body: toLegacyConfigResponse(data as HostedRuntimeConfig) };
    case 'webhookEndpoint':
      return { ...response, body: toLegacyWebhookEndpointResponse(data as CloudWebhookEndpoint) };
    case 'webhookEndpoints':
      return { ...response, body: toLegacyWebhookEndpointListResponse(Array.isArray(data) ? data : [data]) };
    case 'empty':
      return { ...response, body: toLegacyEmptyResponse() };
  }
}

function extractRouteData(body: unknown): unknown {
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: unknown }).data;
  return body;
}

function inferLegacyPagination(data: unknown): LegacyPagination {
  const total = Array.isArray(data) ? data.length : data == null ? 0 : 1;
  return { ...DEFAULT_LEGACY_PAGINATION, total, totalPages: total > 0 ? 1 : 0 };
}

function normalizeLegacyOrganizationPayload(data: unknown): { organization: CloudOrganization; role?: CloudOrganizationRole } {
  if (data && typeof data === 'object' && 'organization' in data) {
    return data as { organization: CloudOrganization; role?: CloudOrganizationRole };
  }
  return { organization: data as CloudOrganization };
}
