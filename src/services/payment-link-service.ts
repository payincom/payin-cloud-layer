import { createCloudAuditEvent, type CloudAuditTrail } from '../audit-risk.js';
import { CloudApiKeyAuthenticator, type CloudApiKeyScope } from '../api-key.js';
import { EntitlementProvider } from '../entitlements.js';
import type { HostedConfigProvider } from '../hosted-config.js';
import { publishCloudPaymentLink, type CloudPaymentLink, type NormalizedCloudPaymentLink } from '../payment-links.js';
import type { CloudPaymentLinkPort } from '../ports.js';
import type { UsageMeter } from '../usage-meter.js';
import type { SubscriptionBillingLimitEnforcer } from '../subscription.js';

export interface CloudPaymentLinkServiceOptions {
  authenticator: CloudApiKeyAuthenticator;
  entitlementProvider: EntitlementProvider;
  hostedConfig: HostedConfigProvider;
  paymentLinks: CloudPaymentLinkPort;
  usageMeter: UsageMeter;
  auditTrail: CloudAuditTrail;
  billingLimitEnforcer?: SubscriptionBillingLimitEnforcer;
}

export interface CloudPaymentLinkCreateServiceRequest {
  apiKey: string;
  title: string;
  description?: string;
  amount: string;
  currency: string;
  chainOptions: string[];
  inventoryTotal?: number | null;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export interface CloudPaymentLinkPublishServiceRequest {
  apiKey: string;
  paymentLinkId: string;
  slug?: string;
  now?: Date;
}

export class CloudPaymentLinkService {
  constructor(private readonly options: CloudPaymentLinkServiceOptions) {}

  async createPaymentLink(request: CloudPaymentLinkCreateServiceRequest): Promise<NormalizedCloudPaymentLink> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'payment-links:create');
    const config = await this.options.hostedConfig.getTenantConfig(scope.tenant);
    if (!config.isTokenEnabled(request.currency)) {
      throw new Error(`Token ${request.currency} is not enabled for this tenant`);
    }
    for (const chain of request.chainOptions) {
      if (!config.isChainEnabled(chain)) {
        throw new Error(`Chain ${chain} is not enabled for this tenant`);
      }
    }

    await this.options.billingLimitEnforcer?.assertCanConsume({
      tenant: scope.tenant,
      limitName: 'paymentLinkLimit',
      usageType: 'payment_link.created',
      requested: 1,
      at: request.now,
      throwOnDeny: true,
    });

    const link = await this.options.paymentLinks.create({
      id: '',
      tenant: scope.tenant,
      title: request.title,
      description: request.description,
      amount: request.amount,
      currency: request.currency,
      chainOptions: request.chainOptions,
      status: 'draft',
      inventoryTotal: request.inventoryTotal,
      metadata: request.metadata,
    } satisfies CloudPaymentLink) as NormalizedCloudPaymentLink;

    await this.options.usageMeter.recordUsage({
      tenant: scope.tenant,
      type: 'payment_link.created',
      subjectId: link.id,
      quantity: 1,
      occurredAt: request.now ?? new Date(),
    });
    await this.options.auditTrail.record(createCloudAuditEvent({
      tenant: scope.tenant,
      action: 'payment-links:create',
      actor: { type: 'api_key', id: scope.apiKeyId },
      subjectId: link.id,
      occurredAt: request.now,
    }));

    return link;
  }

  async publishPaymentLink(request: CloudPaymentLinkPublishServiceRequest): Promise<NormalizedCloudPaymentLink> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'payment-links:update');
    const existing = await this.options.paymentLinks.get(request.paymentLinkId, scope.tenant) as CloudPaymentLink | null;
    if (!existing) throw new Error(`Payment link not found: ${request.paymentLinkId}`);

    const published = publishCloudPaymentLink(existing, { slug: request.slug });
    const updated = await this.options.paymentLinks.update(existing.id, scope.tenant, {
      status: published.status,
      slug: published.slug,
    }) as NormalizedCloudPaymentLink;

    await this.options.auditTrail.record(createCloudAuditEvent({
      tenant: scope.tenant,
      action: 'payment-links:update',
      actor: { type: 'api_key', id: scope.apiKeyId },
      subjectId: updated.id,
      occurredAt: request.now,
    }));

    return updated;
  }

  private async authenticateAndAuthorize(apiKey: string, capability: 'payment-links:create' | 'payment-links:update' | 'payment-links:read'): Promise<CloudApiKeyScope> {
    const scope = await this.options.authenticator.authenticate(apiKey);
    await this.options.authenticator.assertCapability(scope, capability);
    await this.options.entitlementProvider.assertAllowed(scope.tenant, capability);
    return scope;
  }
}
