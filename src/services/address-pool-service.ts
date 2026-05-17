import { createCloudAuditEvent, type CloudAuditTrail } from '../audit-risk.js';
import { CloudApiKeyAuthenticator, type CloudApiKeyScope } from '../api-key.js';
import type { AddressPoolSummary, CloudAddressProtocol, NormalizedCloudAddressPoolEntry } from '../address-pool.js';
import { type CloudCapability, type EntitlementProvider } from '../entitlements.js';
import type { CloudAddressPoolPort } from '../ports.js';
import type { UsageMeter } from '../usage-meter.js';
import type { SubscriptionBillingLimitEnforcer } from '../subscription.js';

export interface CloudAddressPoolServiceOptions {
  authenticator: CloudApiKeyAuthenticator;
  entitlementProvider: EntitlementProvider;
  addressPool: CloudAddressPoolPort;
  usageMeter: UsageMeter;
  auditTrail: CloudAuditTrail;
  billingLimitEnforcer?: SubscriptionBillingLimitEnforcer;
}

export interface CloudAddressPoolImportServiceRequest {
  apiKey: string;
  protocol: CloudAddressProtocol;
  addresses: Array<{ address: string; derivationIndex?: number | null }>;
  masterPublicKeyRef?: string;
  limit?: number | null;
  now?: Date;
}

export interface CloudAddressPoolSummaryServiceRequest {
  apiKey: string;
}

export interface CloudAddressPoolListServiceRequest {
  apiKey: string;
  protocol?: string;
  state?: string;
}

export class CloudAddressPoolService {
  constructor(private readonly options: CloudAddressPoolServiceOptions) {}

  async importAddresses(request: CloudAddressPoolImportServiceRequest): Promise<NormalizedCloudAddressPoolEntry[]> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'address-pool:import');
    await this.options.billingLimitEnforcer?.assertCanConsume({
      tenant: scope.tenant,
      limitName: 'addressPoolLimit',
      usageType: 'address_pool.imported',
      requested: request.addresses.length,
      at: request.now,
      throwOnDeny: true,
    });
    const imported = await this.options.addressPool.import({
      tenant: scope.tenant,
      protocol: request.protocol,
      addresses: request.addresses,
      masterPublicKeyRef: request.masterPublicKeyRef,
      limit: request.limit,
    }) as NormalizedCloudAddressPoolEntry[];

    await this.options.usageMeter.recordUsage({
      tenant: scope.tenant,
      type: 'address_pool.imported',
      subjectId: request.protocol,
      quantity: imported.length,
      occurredAt: request.now ?? new Date(),
    });
    await this.options.auditTrail.record(createCloudAuditEvent({
      tenant: scope.tenant,
      action: 'address-pool:import',
      actor: { type: 'api_key', id: scope.apiKeyId },
      subjectId: request.protocol,
      occurredAt: request.now,
      metadata: { importedCount: imported.length },
    }));

    return imported;
  }

  async getSummary(request: CloudAddressPoolSummaryServiceRequest): Promise<AddressPoolSummary> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'address-pool:read');
    return this.options.addressPool.summary(scope.tenant) as Promise<AddressPoolSummary>;
  }

  async listAddresses(request: CloudAddressPoolListServiceRequest): Promise<NormalizedCloudAddressPoolEntry[]> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'address-pool:read');
    if (!this.options.addressPool.list) throw new Error('Address pool list adapter is not configured');
    return this.options.addressPool.list(scope.tenant, { protocol: request.protocol, state: request.state }) as Promise<NormalizedCloudAddressPoolEntry[]>;
  }

  private async authenticateAndAuthorize(apiKey: string, capability: Extract<CloudCapability, 'address-pool:import' | 'address-pool:read'>): Promise<CloudApiKeyScope> {
    const scope = await this.options.authenticator.authenticate(apiKey);
    await this.options.authenticator.assertCapability(scope, capability);
    await this.options.entitlementProvider.assertAllowed(scope.tenant, capability);
    return scope;
  }
}
