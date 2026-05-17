import { createCloudAuditEvent, type CloudAuditTrail } from '../audit-risk.js';
import { CloudApiKeyAuthenticator, type CloudApiKeyScope } from '../api-key.js';
import { EntitlementProvider } from '../entitlements.js';
import { createCloudOrderDraft, type CloudOrderDraftInput, type NormalizedCloudOrder } from '../orders.js';
import type { CloudOrderPort } from '../ports.js';
import type { HostedConfigProvider } from '../hosted-config.js';
import type { UsageMeter } from '../usage-meter.js';
import type { SubscriptionBillingLimitEnforcer } from '../subscription.js';

export interface CloudOrderServiceOptions {
  authenticator: CloudApiKeyAuthenticator;
  entitlementProvider: EntitlementProvider;
  hostedConfig: HostedConfigProvider;
  orders: CloudOrderPort;
  usageMeter: UsageMeter;
  auditTrail: CloudAuditTrail;
  billingLimitEnforcer?: SubscriptionBillingLimitEnforcer;
}

export interface CloudOrderCreateServiceRequest extends Omit<CloudOrderDraftInput, 'tenant'> {
  apiKey: string;
  now?: Date;
}

export interface CloudOrderGetServiceRequest {
  apiKey: string;
  orderId: string;
}

export interface CloudOrderListServiceRequest {
  apiKey: string;
  status?: string;
}

export class CloudOrderService {
  constructor(private readonly options: CloudOrderServiceOptions) {}

  async createOrder(request: CloudOrderCreateServiceRequest): Promise<NormalizedCloudOrder> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'orders:create');
    const config = await this.options.hostedConfig.getTenantConfig(scope.tenant);
    if (!config.isChainEnabled(request.chainId)) {
      throw new Error(`Chain ${request.chainId} is not enabled for this tenant`);
    }
    if (!config.isTokenEnabled(request.currency)) {
      throw new Error(`Token ${request.currency} is not enabled for this tenant`);
    }

    await this.options.billingLimitEnforcer?.assertCanConsume({
      tenant: scope.tenant,
      limitName: 'monthlyOrderLimit',
      usageType: 'order.created',
      requested: 1,
      at: request.now,
      throwOnDeny: true,
    });

    const draft = createCloudOrderDraft({
      tenant: scope.tenant,
      orderReference: request.orderReference,
      amount: request.amount,
      currency: request.currency,
      chainId: request.chainId,
      metadata: request.metadata,
    });
    const order = await this.options.orders.create(draft) as NormalizedCloudOrder;

    await this.options.usageMeter.recordUsage({
      tenant: scope.tenant,
      type: 'order.created',
      subjectId: order.id,
      quantity: 1,
      occurredAt: request.now ?? new Date(),
    });
    await this.options.auditTrail.record(createCloudAuditEvent({
      tenant: scope.tenant,
      action: 'orders:create',
      actor: { type: 'api_key', id: scope.apiKeyId },
      subjectId: order.id,
      occurredAt: request.now,
    }));

    return order;
  }

  async getOrder(request: CloudOrderGetServiceRequest): Promise<NormalizedCloudOrder> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'orders:read');
    const order = await this.options.orders.get(request.orderId, scope.tenant) as NormalizedCloudOrder | null;
    if (!order) throw new Error(`Order not found: ${request.orderId}`);
    return order;
  }

  async listOrders(request: CloudOrderListServiceRequest): Promise<NormalizedCloudOrder[]> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'orders:read');
    return this.options.orders.list(scope.tenant, { status: request.status }) as Promise<NormalizedCloudOrder[]>;
  }

  private async authenticateAndAuthorize(apiKey: string, capability: 'orders:create' | 'orders:read'): Promise<CloudApiKeyScope> {
    const scope = await this.options.authenticator.authenticate(apiKey);
    await this.options.authenticator.assertCapability(scope, capability);
    await this.options.entitlementProvider.assertAllowed(scope.tenant, capability);
    return scope;
  }
}
