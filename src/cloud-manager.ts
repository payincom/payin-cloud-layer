import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';
import { AllowAllEntitlements, type CloudCapability, type EntitlementProvider } from './entitlements.js';
import {
  NoopBillingUsageReporter,
  NoopCloudAuditLogger,
  runCloudSideEffect,
  type BillingUsageReporter,
  type CloudAuditLogger,
  type CloudSideEffectPolicy,
} from './hooks.js';

export interface CloudOrderRequest extends Record<string, unknown> {
  orderReference?: string;
  amount?: string;
  currency?: string;
  chainId?: string;
}

export interface CloudPaymentLinkRequest extends Record<string, unknown> {
  title?: string;
  amount?: string;
  currency?: string;
}

export interface CloudApiKeyRequest extends Record<string, unknown> {
  name: string;
  expiresAt?: string;
}

export interface CloudAddressPoolImportRequest {
  protocol: 'evm' | 'tron' | 'solana' | string;
  addresses: string[];
}

export interface CloudManagerBackend {
  createOrder(request: CloudOrderRequest & { organizationId: string }): Promise<any>;
  getOrder(orderId: string, organizationId: string): Promise<any>;
  listOrders(filters: Record<string, unknown> & { organizationId: string }): Promise<any>;
  createPaymentLink(request: CloudPaymentLinkRequest & { organizationId: string }): Promise<any>;
  updatePaymentLink(paymentLinkId: string, organizationId: string, updates: Record<string, unknown>): Promise<any>;
  getPaymentLink(paymentLinkId: string, organizationId: string): Promise<any>;
  listPaymentLinks(filters: Record<string, unknown> & { organizationId: string }): Promise<any>;
  createApiKey?(request: CloudApiKeyRequest & { organizationId: string }): Promise<any>;
  listApiKeys?(organizationId: string): Promise<any>;
  revokeApiKey?(apiKeyId: string, organizationId: string): Promise<any>;
  importAddressPool?(request: CloudAddressPoolImportRequest & { organizationId: string }): Promise<any>;
  getAddressPoolAvailability?(organizationId: string, protocol?: string): Promise<any>;
  listWebhooks?(organizationId: string): Promise<any>;
  testWebhook?(webhookId: string, organizationId: string): Promise<any>;
}

export interface CloudManagerOptions {
  tenant: CloudTenantContext;
  entitlementProvider?: EntitlementProvider;
  billingUsageReporter?: BillingUsageReporter;
  auditLogger?: CloudAuditLogger;
  /** Defaults to strict because Cloud billing/audit failures are compliance-sensitive. */
  sideEffectPolicy?: CloudSideEffectPolicy;
  onSideEffectError?: (error: unknown) => void;
}

/**
 * PayIn Cloud manager overlay.
 *
 * Cloud keeps tenant, entitlement, billing, and audit concerns here. The shared
 * Open manager/core remains tenant-agnostic at its public Open facade; this
 * overlay injects explicit organization scope only at the Cloud boundary.
 */
export class CloudManager {
  readonly tenant: NormalizedCloudTenantContext;
  private readonly entitlementProvider: EntitlementProvider;
  private readonly billingUsageReporter: BillingUsageReporter;
  private readonly auditLogger: CloudAuditLogger;
  private readonly sideEffectPolicy: CloudSideEffectPolicy;
  private readonly onSideEffectError?: (error: unknown) => void;

  constructor(
    private readonly backend: CloudManagerBackend,
    options: CloudManagerOptions
  ) {
    this.tenant = normalizeCloudTenantContext(options.tenant);
    this.entitlementProvider = options.entitlementProvider ?? new AllowAllEntitlements();
    this.billingUsageReporter = options.billingUsageReporter ?? new NoopBillingUsageReporter();
    this.auditLogger = options.auditLogger ?? new NoopCloudAuditLogger();
    this.sideEffectPolicy = options.sideEffectPolicy ?? 'strict';
    this.onSideEffectError = options.onSideEffectError;
  }

  get organizationId(): string {
    return this.tenant.organizationId;
  }

  async createOrder(request: CloudOrderRequest): Promise<any> {
    await this.assertAllowed('orders:create');
    const order = await this.backend.createOrder({ ...request, organizationId: this.organizationId });
    const subjectId = order?.orderId ?? order?.id;
    await this.recordUsage({ type: 'order.created', subjectId });
    await this.audit({ action: 'orders:create', subjectId });
    return order;
  }

  async getOrder(orderId: string): Promise<any> {
    await this.assertAllowed('orders:read');
    await this.audit({ action: 'orders:read', subjectId: orderId });
    return this.backend.getOrder(orderId, this.organizationId);
  }

  async listOrders(filters: Record<string, unknown> = {}): Promise<any> {
    await this.assertAllowed('orders:read');
    return this.backend.listOrders({ ...filters, organizationId: this.organizationId });
  }

  async createPaymentLink(request: CloudPaymentLinkRequest): Promise<any> {
    await this.assertAllowed('payment-links:create');
    const paymentLink = await this.backend.createPaymentLink({ ...request, organizationId: this.organizationId });
    const subjectId = paymentLink?.paymentLinkId ?? paymentLink?.id;
    await this.recordUsage({ type: 'payment_link.created', subjectId });
    await this.audit({ action: 'payment-links:create', subjectId });
    return paymentLink;
  }

  async updatePaymentLink(paymentLinkId: string, updates: Record<string, unknown>): Promise<any> {
    await this.assertAllowed('payment-links:update');
    await this.audit({ action: 'payment-links:update', subjectId: paymentLinkId });
    return this.backend.updatePaymentLink(paymentLinkId, this.organizationId, updates);
  }

  async getPaymentLink(paymentLinkId: string): Promise<any> {
    await this.assertAllowed('payment-links:read');
    return this.backend.getPaymentLink(paymentLinkId, this.organizationId);
  }

  async listPaymentLinks(filters: Record<string, unknown> = {}): Promise<any> {
    await this.assertAllowed('payment-links:read');
    return this.backend.listPaymentLinks({ ...filters, organizationId: this.organizationId });
  }

  async createApiKey(request: CloudApiKeyRequest): Promise<any> {
    await this.assertAllowed('api-keys:create');
    this.requireBackend('createApiKey');
    const apiKey = await this.backend.createApiKey!({ ...request, organizationId: this.organizationId });
    const subjectId = apiKey?.id ?? apiKey?.apiKeyId;
    await this.recordUsage({ type: 'api_key.created', subjectId });
    await this.audit({ action: 'api-keys:create', subjectId });
    return apiKey;
  }

  async listApiKeys(): Promise<any> {
    await this.assertAllowed('api-keys:read');
    this.requireBackend('listApiKeys');
    return this.backend.listApiKeys!(this.organizationId);
  }

  async revokeApiKey(apiKeyId: string): Promise<any> {
    await this.assertAllowed('api-keys:revoke');
    this.requireBackend('revokeApiKey');
    const result = await this.backend.revokeApiKey!(apiKeyId, this.organizationId);
    await this.recordUsage({ type: 'api_key.revoked', subjectId: apiKeyId });
    await this.audit({ action: 'api-keys:revoke', subjectId: apiKeyId });
    return result;
  }

  async importAddressPool(request: CloudAddressPoolImportRequest): Promise<any> {
    await this.assertAllowed('address-pool:import');
    this.requireBackend('importAddressPool');
    const result = await this.backend.importAddressPool!({ ...request, organizationId: this.organizationId });
    await this.recordUsage({ type: 'address_pool.imported', quantity: request.addresses.length, metadata: { protocol: request.protocol } });
    await this.audit({ action: 'address-pool:import', metadata: { protocol: request.protocol, count: request.addresses.length } });
    return result;
  }

  async getAddressPoolAvailability(protocol?: string): Promise<any> {
    await this.assertAllowed('address-pool:read');
    this.requireBackend('getAddressPoolAvailability');
    return this.backend.getAddressPoolAvailability!(this.organizationId, protocol);
  }

  async listWebhooks(): Promise<any> {
    await this.assertAllowed('webhooks:read');
    this.requireBackend('listWebhooks');
    return this.backend.listWebhooks!(this.organizationId);
  }

  async testWebhook(webhookId: string): Promise<any> {
    await this.assertAllowed('webhooks:test');
    this.requireBackend('testWebhook');
    const result = await this.backend.testWebhook!(webhookId, this.organizationId);
    await this.recordUsage({ type: 'webhook.tested', subjectId: webhookId });
    await this.audit({ action: 'webhooks:test', subjectId: webhookId });
    return result;
  }

  private async assertAllowed(capability: CloudCapability): Promise<void> {
    await this.entitlementProvider.assertAllowed(this.tenant, capability);
  }

  private async recordUsage(event: Omit<Parameters<BillingUsageReporter['recordUsage']>[0], 'tenant'>): Promise<void> {
    await runCloudSideEffect(
      this.sideEffectPolicy,
      () => this.billingUsageReporter.recordUsage({ tenant: this.tenant, ...event }),
      this.onSideEffectError
    );
  }

  private async audit(event: Omit<Parameters<CloudAuditLogger['record']>[0], 'tenant'>): Promise<void> {
    await runCloudSideEffect(
      this.sideEffectPolicy,
      () => this.auditLogger.record({ tenant: this.tenant, ...event }),
      this.onSideEffectError
    );
  }

  private requireBackend(method: keyof CloudManagerBackend): void {
    if (typeof this.backend[method] !== 'function') {
      throw new Error(`CloudManager backend does not implement ${String(method)}`);
    }
  }
}
