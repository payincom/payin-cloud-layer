import { createCloudAuditEvent, type CloudAuditTrail } from '../audit-risk.js';
import {
  CloudApiKeyAuthenticator,
  type CloudApiKey,
  type CloudApiKeyManagementRepository,
  type CloudApiKeyScope,
} from '../api-key.js';
import { type CloudCapability, type EntitlementProvider } from '../entitlements.js';
import type { CloudOrganizationRole } from '../organization.js';
import type { UsageMeter } from '../usage-meter.js';
import type { SubscriptionBillingLimitEnforcer } from '../subscription.js';

export interface CloudApiKeyServiceOptions {
  authenticator: CloudApiKeyAuthenticator;
  entitlementProvider: EntitlementProvider;
  apiKeys: CloudApiKeyManagementRepository;
  usageMeter: UsageMeter;
  auditTrail: CloudAuditTrail;
  secretFactory?: () => string;
  idFactory?: () => string;
  billingLimitEnforcer?: SubscriptionBillingLimitEnforcer;
}

export interface CloudApiKeyCreateServiceRequest {
  apiKey: string;
  name: string;
  role?: CloudOrganizationRole;
  capabilities?: CloudCapability[];
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export interface CloudApiKeyCreateServiceResult {
  presentedKey: string;
  apiKey: CloudApiKey;
}

export interface CloudApiKeyListServiceRequest {
  apiKey: string;
}

export interface CloudApiKeyRevokeServiceRequest {
  apiKey: string;
  apiKeyId: string;
  now?: Date;
}

export class CloudApiKeyService {
  constructor(private readonly options: CloudApiKeyServiceOptions) {}

  async createApiKey(request: CloudApiKeyCreateServiceRequest): Promise<CloudApiKeyCreateServiceResult> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'api-keys:create');
    const now = request.now ?? new Date();
    await this.options.billingLimitEnforcer?.assertCanConsume({
      tenant: scope.tenant,
      limitName: 'apiKeyLimit',
      usageType: 'api_key.created',
      requested: 1,
      at: now,
      throwOnDeny: true,
    });
    const presentedKey = this.options.secretFactory?.() ?? generateApiKeySecret();
    const apiKey: CloudApiKey = {
      id: this.options.idFactory?.() ?? `key_${now.getTime()}`,
      keyPrefix: presentedKey.slice(0, Math.min(8, presentedKey.length)),
      name: request.name.trim(),
      organizationId: scope.tenant.organizationId,
      userId: scope.userId,
      role: request.role,
      capabilities: request.capabilities,
      expiresAt: request.expiresAt,
      createdAt: now,
      metadata: request.metadata,
    };

    const created = await this.options.apiKeys.create({
      presentedKey,
      apiKey,
      tenant: scope.tenant,
      membership: { role: request.role ?? scope.role ?? 'viewer', status: 'active' },
    });

    await this.options.usageMeter.recordUsage({
      tenant: scope.tenant,
      type: 'api_key.created',
      subjectId: created.id,
      quantity: 1,
      occurredAt: now,
    });
    await this.options.auditTrail.record(createCloudAuditEvent({
      tenant: scope.tenant,
      action: 'api-keys:create',
      actor: { type: 'api_key', id: scope.apiKeyId },
      subjectId: created.id,
      occurredAt: now,
      metadata: { role: created.role, capabilities: created.capabilities },
    }));

    return { presentedKey, apiKey: created };
  }

  async listApiKeys(request: CloudApiKeyListServiceRequest): Promise<CloudApiKey[]> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'api-keys:read');
    return this.options.apiKeys.listForTenant(scope.tenant);
  }

  async revokeApiKey(request: CloudApiKeyRevokeServiceRequest): Promise<CloudApiKey> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'api-keys:revoke');
    const now = request.now ?? new Date();
    const revoked = await this.options.apiKeys.revokeForTenant(request.apiKeyId, scope.tenant, now);

    await this.options.usageMeter.recordUsage({
      tenant: scope.tenant,
      type: 'api_key.revoked',
      subjectId: revoked.id,
      quantity: 1,
      occurredAt: now,
    });
    await this.options.auditTrail.record(createCloudAuditEvent({
      tenant: scope.tenant,
      action: 'api-keys:revoke',
      actor: { type: 'api_key', id: scope.apiKeyId },
      subjectId: revoked.id,
      occurredAt: now,
    }));

    return revoked;
  }

  private async authenticateAndAuthorize(apiKey: string, capability: Extract<CloudCapability, 'api-keys:create' | 'api-keys:read' | 'api-keys:revoke'>): Promise<CloudApiKeyScope> {
    const scope = await this.options.authenticator.authenticate(apiKey);
    await this.options.authenticator.assertCapability(scope, capability);
    await this.options.entitlementProvider.assertAllowed(scope.tenant, capability);
    return scope;
  }
}

function generateApiKeySecret(): string {
  return `pk_live_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
