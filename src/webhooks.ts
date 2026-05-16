import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';

export type CloudWebhookEventType =
  | '*'
  | 'order.created'
  | 'order.completed'
  | 'order.failed'
  | 'payment_link.created'
  | 'payment_link.order_created'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'address_pool.imported'
  | 'webhook.tested'
  | string;

export interface CloudWebhookEvent {
  id: string;
  tenant: CloudTenantContext;
  type: CloudWebhookEventType;
  subjectId?: string;
  occurredAt: Date;
  data: Record<string, unknown>;
}

export interface CloudWebhookEndpointInput {
  id: string;
  tenant: CloudTenantContext;
  url: string;
  eventTypes: CloudWebhookEventType[];
  signingSecretRef: string;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CloudWebhookEndpoint extends Omit<CloudWebhookEndpointInput, 'tenant'> {
  tenant: NormalizedCloudTenantContext;
}

export interface RedactedCloudWebhookEndpoint extends Omit<CloudWebhookEndpoint, 'signingSecretRef'> {
  signingSecretConfigured: boolean;
}

export interface CloudWebhookDelivery {
  endpointId: string;
  tenant: NormalizedCloudTenantContext;
  url: string;
  event: CloudWebhookEvent;
  headers: Record<string, string>;
  body: string;
}

export interface CloudWebhookSigner {
  sign(input: { endpointId: string; secretRef: string; body: string; event: CloudWebhookEvent }): Promise<string> | string;
}

export interface CloudWebhookEndpointRepository {
  listForTenant(tenant: CloudTenantContext): Promise<CloudWebhookEndpoint[]> | CloudWebhookEndpoint[];
  getForTenant(endpointId: string, tenant: CloudTenantContext): Promise<CloudWebhookEndpoint | null> | CloudWebhookEndpoint | null;
}

export class CloudWebhookSecretError extends Error {
  readonly code = 'CLOUD_WEBHOOK_SECRET_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'CloudWebhookSecretError';
  }
}

export class CloudWebhookEndpointDisabledError extends Error {
  readonly code = 'CLOUD_WEBHOOK_ENDPOINT_DISABLED';

  constructor(endpointId: string) {
    super(`Cloud webhook endpoint is disabled: ${endpointId}`);
    this.name = 'CloudWebhookEndpointDisabledError';
  }
}

export class CloudWebhookDeliveryError extends Error {
  readonly code = 'CLOUD_WEBHOOK_DELIVERY_FAILED';

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CloudWebhookDeliveryError';
  }
}

export function normalizeCloudWebhookEndpoint(input: CloudWebhookEndpointInput): CloudWebhookEndpoint {
  if (!input.signingSecretRef.startsWith('secret://')) {
    throw new CloudWebhookSecretError('Cloud webhook signingSecretRef must be a secret:// reference');
  }

  return {
    ...input,
    tenant: normalizeCloudTenantContext(input.tenant),
    eventTypes: [...new Set(input.eventTypes)],
  };
}

export function redactCloudWebhookEndpoint(endpoint: CloudWebhookEndpoint): RedactedCloudWebhookEndpoint {
  const { signingSecretRef, ...redacted } = endpoint;
  void signingSecretRef;
  return {
    ...redacted,
    signingSecretConfigured: true,
  };
}

export function filterWebhookEndpointsForEvent(
  endpoints: CloudWebhookEndpoint[],
  event: CloudWebhookEvent
): CloudWebhookEndpoint[] {
  const eventTenant = normalizeCloudTenantContext(event.tenant);
  return endpoints.filter((endpoint) =>
    endpoint.enabled &&
    endpoint.tenant.organizationId === eventTenant.organizationId &&
    (endpoint.eventTypes.includes('*') || endpoint.eventTypes.includes(event.type))
  );
}

export async function createCloudWebhookDelivery(
  endpoint: CloudWebhookEndpoint,
  event: CloudWebhookEvent,
  signer: CloudWebhookSigner
): Promise<CloudWebhookDelivery> {
  if (!endpoint.enabled) {
    throw new CloudWebhookEndpointDisabledError(endpoint.id);
  }

  const normalizedEvent: CloudWebhookEvent = {
    ...event,
    tenant: normalizeCloudTenantContext(event.tenant),
  };
  const body = JSON.stringify({
    id: normalizedEvent.id,
    type: normalizedEvent.type,
    subjectId: normalizedEvent.subjectId,
    occurredAt: normalizedEvent.occurredAt.toISOString(),
    data: normalizedEvent.data,
  });

  let signature: string;
  try {
    signature = await signer.sign({ endpointId: endpoint.id, secretRef: endpoint.signingSecretRef, body, event: normalizedEvent });
  } catch (error) {
    throw new CloudWebhookDeliveryError('Cloud webhook signing failed', error);
  }

  return {
    endpointId: endpoint.id,
    tenant: endpoint.tenant,
    url: endpoint.url,
    event: normalizedEvent,
    body,
    headers: {
      'content-type': 'application/json',
      'payin-event-id': normalizedEvent.id,
      'payin-event-type': normalizedEvent.type,
      'payin-signature': signature,
    },
  };
}

export class StaticCloudWebhookSigner implements CloudWebhookSigner {
  constructor(private readonly signature: string) {}

  sign(): string {
    return this.signature;
  }
}

export class InMemoryCloudWebhookEndpointRepository implements CloudWebhookEndpointRepository {
  constructor(private readonly endpoints: CloudWebhookEndpoint[]) {}

  listForTenant(tenant: CloudTenantContext): CloudWebhookEndpoint[] {
    const normalizedTenant = normalizeCloudTenantContext(tenant);
    return this.endpoints.filter((endpoint) => endpoint.tenant.organizationId === normalizedTenant.organizationId);
  }

  getForTenant(endpointId: string, tenant: CloudTenantContext): CloudWebhookEndpoint | null {
    const normalizedTenant = normalizeCloudTenantContext(tenant);
    return this.endpoints.find((endpoint) =>
      endpoint.id === endpointId && endpoint.tenant.organizationId === normalizedTenant.organizationId
    ) ?? null;
  }
}
