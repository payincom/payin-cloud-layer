import { createCloudAuditEvent, type CloudAuditTrail } from '../audit-risk.js';
import { CloudApiKeyAuthenticator, type CloudApiKeyScope } from '../api-key.js';
import { type CloudCapability, type EntitlementProvider } from '../entitlements.js';
import type { UsageMeter } from '../usage-meter.js';
import {
  createCloudWebhookDelivery,
  type CloudWebhookDelivery,
  type CloudWebhookEndpoint,
  type CloudWebhookEventType,
  type CloudWebhookSigner,
} from '../webhooks.js';
import type { MutableCloudWebhookEndpointRepository } from '../adapters/repositories/webhook-adapter.js';

export interface CloudWebhookServiceOptions {
  authenticator: CloudApiKeyAuthenticator;
  entitlementProvider: EntitlementProvider;
  webhooks: MutableCloudWebhookEndpointRepository;
  signer: CloudWebhookSigner;
  usageMeter: UsageMeter;
  auditTrail: CloudAuditTrail;
}

export interface CloudWebhookEndpointUpsertServiceRequest {
  apiKey: string;
  id: string;
  url: string;
  eventTypes: CloudWebhookEventType[];
  signingSecretRef: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export interface CloudWebhookTestDeliveryServiceRequest {
  apiKey: string;
  endpointId: string;
  eventId?: string;
  now?: Date;
}

export class CloudWebhookService {
  constructor(private readonly options: CloudWebhookServiceOptions) {}

  async upsertEndpoint(request: CloudWebhookEndpointUpsertServiceRequest): Promise<CloudWebhookEndpoint> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'config:update');
    const endpoint = await this.options.webhooks.upsert({
      id: request.id,
      tenant: scope.tenant,
      url: request.url,
      eventTypes: request.eventTypes,
      signingSecretRef: request.signingSecretRef,
      enabled: request.enabled,
      metadata: request.metadata,
      createdAt: request.now,
      updatedAt: request.now,
    });

    await this.options.auditTrail.record(createCloudAuditEvent({
      tenant: scope.tenant,
      action: 'config:update',
      actor: { type: 'api_key', id: scope.apiKeyId },
      subjectId: endpoint.id,
      occurredAt: request.now,
      metadata: { resource: 'webhook_endpoint' },
    }));

    return endpoint;
  }

  async createTestDelivery(request: CloudWebhookTestDeliveryServiceRequest): Promise<CloudWebhookDelivery> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'webhooks:test');
    const endpoint = await this.options.webhooks.getForTenant(request.endpointId, scope.tenant);
    if (!endpoint) throw new Error(`Webhook endpoint not found: ${request.endpointId}`);

    const occurredAt = request.now ?? new Date();
    const delivery = await createCloudWebhookDelivery(endpoint, {
      id: request.eventId ?? `evt_webhook_test_${occurredAt.getTime()}`,
      tenant: scope.tenant,
      type: 'webhook.tested',
      subjectId: endpoint.id,
      occurredAt,
      data: { test: true },
    }, this.options.signer);

    await this.options.usageMeter.recordUsage({
      tenant: scope.tenant,
      type: 'webhook.tested',
      subjectId: endpoint.id,
      quantity: 1,
      occurredAt,
    });
    await this.options.auditTrail.record(createCloudAuditEvent({
      tenant: scope.tenant,
      action: 'webhooks:test',
      actor: { type: 'api_key', id: scope.apiKeyId },
      subjectId: endpoint.id,
      occurredAt,
    }));

    return delivery;
  }

  private async authenticateAndAuthorize(apiKey: string, capability: Extract<CloudCapability, 'config:update' | 'webhooks:test' | 'webhooks:read'>): Promise<CloudApiKeyScope> {
    const scope = await this.options.authenticator.authenticate(apiKey);
    await this.options.authenticator.assertCapability(scope, capability);
    await this.options.entitlementProvider.assertAllowed(scope.tenant, capability);
    return scope;
  }
}
