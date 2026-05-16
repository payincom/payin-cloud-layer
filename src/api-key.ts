import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';
import type { CloudCapability } from './entitlements.js';
import { hasCloudRoleCapability, verifyCloudMembership, type CloudOrganizationMember, type CloudOrganizationRole } from './organization.js';

export type CloudApiKeyStatus = 'active' | 'revoked' | 'expired';

export interface CloudApiKey {
  id: string;
  /** Prefix safe to expose in logs/UI, e.g. pk_live_. Never store or return raw secret here. */
  keyPrefix: string;
  name: string;
  organizationId: string;
  userId?: string;
  role?: CloudOrganizationRole;
  capabilities?: CloudCapability[];
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt?: Date;
  lastUsedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CloudApiKeyScope {
  apiKeyId: string;
  tenant: NormalizedCloudTenantContext;
  userId?: string;
  role?: CloudOrganizationRole;
  capabilities: CloudCapability[];
}

export interface CloudApiKeyLookupResult {
  apiKey: CloudApiKey | null;
  /** Optional raw membership loaded by the adapter. If present, it must be active. */
  membership?: Pick<CloudOrganizationMember, 'role' | 'status'> | null;
  /** Optional tenant metadata loaded by the adapter. organizationId is normalized from apiKey if omitted. */
  tenant?: CloudTenantContext;
}

export interface CloudApiKeyCreateInput {
  presentedKey: string;
  apiKey: CloudApiKey;
  tenant: CloudTenantContext;
  membership?: Pick<CloudOrganizationMember, 'role' | 'status'> | null;
}

export interface CloudApiKeyRepository {
  /** Implementations must verify the presented raw key and return only metadata/scope, never the raw secret. */
  findByPresentedKey(presentedKey: string): Promise<CloudApiKeyLookupResult> | CloudApiKeyLookupResult;
  recordSuccessfulUse?(apiKeyId: string, usedAt: Date): Promise<void> | void;
}

export interface CloudApiKeyManagementRepository extends CloudApiKeyRepository {
  create(input: CloudApiKeyCreateInput): Promise<CloudApiKey> | CloudApiKey;
  listForTenant(tenant: CloudTenantContext): Promise<CloudApiKey[]> | CloudApiKey[];
  revokeForTenant(apiKeyId: string, tenant: CloudTenantContext, revokedAt: Date): Promise<CloudApiKey> | CloudApiKey;
}

export class CloudApiKeyAuthenticationError extends Error {
  readonly code = 'CLOUD_API_KEY_AUTHENTICATION_FAILED';

  constructor(message = 'Cloud API key authentication failed') {
    super(message);
    this.name = 'CloudApiKeyAuthenticationError';
  }
}

export class CloudApiKeyAuthorizationError extends Error {
  readonly code = 'CLOUD_API_KEY_AUTHORIZATION_FAILED';

  constructor(message = 'Cloud API key is not authorized for this capability') {
    super(message);
    this.name = 'CloudApiKeyAuthorizationError';
  }
}

export function getCloudApiKeyStatus(apiKey: Pick<CloudApiKey, 'expiresAt' | 'revokedAt'>, now = new Date()): CloudApiKeyStatus {
  if (apiKey.revokedAt) return 'revoked';
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'active';
}

export function assertCloudApiKeyActive(apiKey: CloudApiKey, now = new Date()): void {
  const status = getCloudApiKeyStatus(apiKey, now);
  if (status !== 'active') {
    throw new CloudApiKeyAuthenticationError(`Cloud API key is ${status}`);
  }
}

export function deriveCloudApiKeyCapabilities(apiKey: CloudApiKey, role = apiKey.role): CloudCapability[] {
  if (apiKey.capabilities?.length) {
    return [...new Set(apiKey.capabilities)];
  }

  if (!role) return [];

  const knownCapabilities: CloudCapability[] = [
    'orders:create',
    'orders:read',
    'payment-links:create',
    'payment-links:update',
    'payment-links:read',
    'api-keys:create',
    'api-keys:read',
    'api-keys:revoke',
    'address-pool:import',
    'address-pool:read',
    'webhooks:test',
    'webhooks:read',
    'config:read',
    'config:update',
  ];

  return knownCapabilities.filter((capability) => hasCloudRoleCapability(role, capability));
}

export class CloudApiKeyAuthenticator {
  constructor(private readonly repository: CloudApiKeyRepository) {}

  async authenticate(presentedKey: string, now = new Date()): Promise<CloudApiKeyScope> {
    if (!presentedKey.trim()) {
      throw new CloudApiKeyAuthenticationError('Cloud API key is required');
    }

    const result = await this.repository.findByPresentedKey(presentedKey);
    if (!result.apiKey) {
      throw new CloudApiKeyAuthenticationError('Cloud API key not found');
    }

    assertCloudApiKeyActive(result.apiKey, now);

    const membership = result.membership ?? null;
    if (membership) {
      const verification = verifyCloudMembership(membership);
      if (!verification.valid) {
        throw new CloudApiKeyAuthenticationError(verification.error ?? 'Cloud API key membership is not active');
      }
    }

    const role = result.apiKey.role ?? membership?.role;
    const tenant = normalizeCloudTenantContext({
      ...result.tenant,
      organizationId: result.tenant?.organizationId ?? result.apiKey.organizationId,
    });

    if (tenant.organizationId !== result.apiKey.organizationId) {
      throw new CloudApiKeyAuthenticationError('Cloud API key tenant does not match organization scope');
    }

    await this.repository.recordSuccessfulUse?.(result.apiKey.id, now);

    return {
      apiKeyId: result.apiKey.id,
      tenant,
      userId: result.apiKey.userId,
      role,
      capabilities: deriveCloudApiKeyCapabilities(result.apiKey, role),
    };
  }

  async assertCapability(scope: CloudApiKeyScope, capability: CloudCapability): Promise<void> {
    if (!scope.capabilities.includes(capability)) {
      throw new CloudApiKeyAuthorizationError();
    }
  }
}

export class InMemoryCloudApiKeyRepository implements CloudApiKeyManagementRepository {
  constructor(
    private readonly records: Array<CloudApiKeyLookupResult & { presentedKey: string }>
  ) {}

  findByPresentedKey(presentedKey: string): CloudApiKeyLookupResult {
    const record = this.records.find((candidate) => candidate.presentedKey === presentedKey);
    if (!record) return { apiKey: null };

    const { presentedKey: _presentedKey, ...result } = record;
    return result;
  }

  recordSuccessfulUse(apiKeyId: string, usedAt: Date): void {
    const record = this.records.find((candidate) => candidate.apiKey?.id === apiKeyId);
    if (record?.apiKey) {
      record.apiKey.lastUsedAt = usedAt;
    }
  }

  create(input: CloudApiKeyCreateInput): CloudApiKey {
    const apiKey = { ...input.apiKey };
    this.records.push({
      presentedKey: input.presentedKey,
      apiKey,
      tenant: normalizeCloudTenantContext(input.tenant),
      membership: input.membership ?? { role: apiKey.role ?? 'viewer', status: 'active' },
    });
    return apiKey;
  }

  listForTenant(tenant: CloudTenantContext): CloudApiKey[] {
    const normalizedTenant = normalizeCloudTenantContext(tenant);
    return this.records
      .map((record) => record.apiKey)
      .filter((apiKey): apiKey is CloudApiKey => apiKey !== null && apiKey.organizationId === normalizedTenant.organizationId)
      .map((apiKey) => ({ ...apiKey }));
  }

  revokeForTenant(apiKeyId: string, tenant: CloudTenantContext, revokedAt: Date): CloudApiKey {
    const normalizedTenant = normalizeCloudTenantContext(tenant);
    const record = this.records.find((candidate) => candidate.apiKey?.id === apiKeyId && candidate.apiKey?.organizationId === normalizedTenant.organizationId);
    if (!record?.apiKey) throw new Error(`API key not found: ${apiKeyId}`);
    record.apiKey.revokedAt = revokedAt;
    return { ...record.apiKey };
  }
}
