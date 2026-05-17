import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';
import { createHmac, timingSafeEqual } from 'node:crypto';

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

export interface CloudWebhookSecretResolver {
  resolve(secretRef: string): Promise<string> | string;
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

/**
 * Production-compatible webhook signer adapted from the old PayIn notification package.
 *
 * Signature format follows the legacy PayIn/Stripe-style scheme:
 * `t=<unix-seconds>,v1=<hmac-sha256(timestamp.body)>`.
 */
export class HmacCloudWebhookSigner implements CloudWebhookSigner {
  constructor(private readonly resolver: CloudWebhookSecretResolver, private readonly now: () => Date = () => new Date()) {}

  async sign(input: { secretRef: string; body: string }): Promise<string> {
    const secret = await this.resolver.resolve(input.secretRef);
    const timestamp = Math.floor(this.now().getTime() / 1000);
    return generateWebhookSignature(input.body, secret, timestamp);
  }
}

export class InMemoryCloudWebhookSecretResolver implements CloudWebhookSecretResolver {
  private readonly secrets: Map<string, string>;

  constructor(secrets: Record<string, string> | Map<string, string>) {
    this.secrets = secrets instanceof Map ? new Map(secrets) : new Map(Object.entries(secrets));
  }

  resolve(secretRef: string): string {
    const secret = this.secrets.get(secretRef);
    if (!secret) throw new CloudWebhookSecretError(`Cloud webhook secret not found for ref: ${secretRef}`);
    return secret;
  }
}

export class EnvironmentCloudWebhookSecretResolver implements CloudWebhookSecretResolver {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  resolve(secretRef: string): string {
    const envName = parseEnvironmentSecretRef(secretRef);
    const secret = this.env[envName];
    if (!secret) throw new CloudWebhookSecretError(`Cloud webhook environment secret is not configured: ${envName}`);
    return secret;
  }
}

export function parseEnvironmentSecretRef(secretRef: string): string {
  const prefix = 'secret://env/';
  if (!secretRef.startsWith(prefix)) {
    throw new CloudWebhookSecretError('Cloud webhook environment secret refs must use secret://env/<NAME>');
  }
  const envName = secretRef.slice(prefix.length);
  if (!/^[A-Z_][A-Z0-9_]*$/.test(envName)) {
    throw new CloudWebhookSecretError(`Invalid cloud webhook environment secret name: ${envName}`);
  }
  return envName;
}

export function generateWebhookSignature(body: string, secret: string, timestamp: number = Math.floor(Date.now() / 1000)): string {
  const signedPayload = createWebhookSignaturePayload({ timestamp, body });
  const signature = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

export function verifyWebhookSignature(input: { body: string; signatureHeader: string; secret: string; toleranceSeconds?: number; now?: Date }): boolean {
  const { timestamp, signature } = parseWebhookSignature(input.signatureHeader);
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (Math.abs(now - timestamp) > toleranceSeconds) throw new CloudWebhookSecretError(`Cloud webhook signature timestamp outside tolerance: ${toleranceSeconds}s`);
  const expected = createHmac('sha256', input.secret).update(createWebhookSignaturePayload({ timestamp, body: input.body }), 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new CloudWebhookSecretError('Cloud webhook signature mismatch');
  }
  return true;
}

export function parseWebhookSignature(signatureHeader: string): { timestamp: number; signature: string } {
  const parts = signatureHeader.split(',');
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signaturePart = parts.find((part) => part.startsWith('v1='));
  if (!timestampPart || !signaturePart) throw new CloudWebhookSecretError('Invalid cloud webhook signature format');
  const timestamp = Number(timestampPart.slice(2));
  const signature = signaturePart.slice(3);
  if (!Number.isInteger(timestamp)) throw new CloudWebhookSecretError('Invalid cloud webhook signature timestamp');
  if (!/^[a-f0-9]{64}$/i.test(signature)) throw new CloudWebhookSecretError('Invalid cloud webhook signature digest');
  return { timestamp, signature };
}

export interface WebhookRetryDecisionInput {
  statusCode?: number;
  errorCode?: string;
}

export function createWebhookSignaturePayload(input: { timestamp: number; body: string }): string {
  return `${input.timestamp}.${input.body}`;
}

export function shouldRetryWebhookDelivery(input: WebhookRetryDecisionInput): boolean {
  if (input.errorCode) return true;
  if (input.statusCode === undefined) return false;
  return input.statusCode === 408 || input.statusCode === 409 || input.statusCode === 425 || input.statusCode === 429 || input.statusCode >= 500;
}

export function calculateWebhookRetryDelayMs(input: {
  attempt: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  random?: () => number;
}): number {
  const baseDelayMs = input.baseDelayMs ?? 1000;
  const maxDelayMs = input.maxDelayMs ?? 30000;
  const attempt = Math.max(1, input.attempt);
  const rawDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  const jitterRatio = input.jitterRatio ?? 0;
  if (jitterRatio <= 0) return rawDelay;
  const random = input.random ?? Math.random;
  const jitter = rawDelay * jitterRatio * (random() * 2 - 1);
  return Math.round(Math.min(maxDelayMs, Math.max(0, rawDelay + jitter)));
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
