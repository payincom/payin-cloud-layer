import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';
import type { CloudOrganizationPlan } from './organization.js';

export interface HostedRuntimeLimits {
  monthlyOrderLimit?: number | null;
  addressPoolLimit?: number | null;
  webhookEndpointLimit?: number | null;
  apiKeyLimit?: number | null;
  paymentLinkLimit?: number | null;
}

export interface HostedSecretRefs {
  webhookSigningSecretRef?: string;
  rpcProviderRefs?: string[];
  billingCustomerRef?: string;
  [key: string]: string | string[] | undefined;
}

export interface HostedRuntimeConfigInput {
  tenant: CloudTenantContext;
  apiBaseUrl?: string;
  enabledChains?: string[];
  enabledTokens?: string[];
  webhookSecretRef?: string;
  rpcProviderRefs?: string[];
  secretRefs?: HostedSecretRefs;
  limits?: HostedRuntimeLimits;
  metadata?: Record<string, unknown>;
}

export interface HostedRuntimeConfig extends Omit<HostedRuntimeConfigInput, 'tenant'> {
  tenant: NormalizedCloudTenantContext;
  enabledChains: string[];
  enabledTokens: string[];
  limits: HostedRuntimeLimits;
  secretRefs?: HostedSecretRefs;
  isChainEnabled(chainId: string): boolean;
  isTokenEnabled(tokenSymbolOrId: string): boolean;
}

export interface HostedConfigProvider {
  getTenantConfig(tenant: CloudTenantContext): Promise<HostedRuntimeConfig> | HostedRuntimeConfig;
}

export interface HostedConfigRepository extends HostedConfigProvider {
  updateTenantConfig(tenant: CloudTenantContext, updates: Partial<HostedRuntimeConfigInput>): Promise<HostedRuntimeConfig> | HostedRuntimeConfig;
}

export class CloudHostedConfigError extends Error {
  readonly code = 'CLOUD_HOSTED_CONFIG_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'CloudHostedConfigError';
  }
}

export interface HostedLimitDecision {
  allowed: boolean;
  limitName: keyof HostedRuntimeLimits;
  limit: number | null | undefined;
  current: number;
  requested: number;
  code?: 'HOSTED_LIMIT_EXCEEDED';
  message?: string;
}

export class HostedLimitExceededError extends Error {
  readonly code = 'HOSTED_LIMIT_EXCEEDED';

  constructor(public readonly decision: HostedLimitDecision) {
    super(decision.message ?? `Hosted limit exceeded: ${String(decision.limitName)}`);
    this.name = 'HostedLimitExceededError';
  }
}

export const DEFAULT_HOSTED_PLAN_LIMITS: Readonly<Record<CloudOrganizationPlan, HostedRuntimeLimits>> = {
  free: {
    monthlyOrderLimit: 100,
    addressPoolLimit: 100,
    webhookEndpointLimit: 1,
    apiKeyLimit: 2,
    paymentLinkLimit: 10,
  },
  pro: {
    monthlyOrderLimit: 10000,
    addressPoolLimit: 10000,
    webhookEndpointLimit: 10,
    apiKeyLimit: 10,
    paymentLinkLimit: 1000,
  },
  enterprise: {
    monthlyOrderLimit: null,
    addressPoolLimit: null,
    webhookEndpointLimit: null,
    apiKeyLimit: null,
    paymentLinkLimit: null,
  },
};

export const DEFAULT_HOSTED_ENABLED_CHAINS = ['ethereum-sepolia'] as const;
export const DEFAULT_HOSTED_ENABLED_TOKENS = ['USDC'] as const;

export function normalizeHostedRuntimeConfig(input: HostedRuntimeConfigInput): HostedRuntimeConfig {
  const tenant = normalizeCloudTenantContext(input.tenant);
  const secretRefs = normalizeHostedSecretRefs({
    ...input.secretRefs,
    ...(input.webhookSecretRef ? { webhookSigningSecretRef: input.webhookSecretRef } : {}),
    ...(input.rpcProviderRefs ? { rpcProviderRefs: input.rpcProviderRefs } : {}),
  });

  const config: HostedRuntimeConfig = {
    ...input,
    tenant,
    enabledChains: [...new Set(input.enabledChains ?? [])],
    enabledTokens: [...new Set(input.enabledTokens ?? [])],
    limits: { ...(input.limits ?? {}) },
    ...(Object.keys(secretRefs).length ? { secretRefs } : {}),
    isChainEnabled(chainId: string): boolean {
      return this.enabledChains.includes(chainId);
    },
    isTokenEnabled(tokenSymbolOrId: string): boolean {
      return this.enabledTokens.includes(tokenSymbolOrId);
    },
  };

  delete (config as { webhookSecretRef?: string }).webhookSecretRef;
  delete (config as { rpcProviderRefs?: string[] }).rpcProviderRefs;

  return config;
}

export function mergeHostedRuntimeConfig(
  base: HostedRuntimeConfig,
  override: Partial<HostedRuntimeConfigInput>
): HostedRuntimeConfig {
  if (override.tenant) {
    const overrideTenant = normalizeCloudTenantContext(override.tenant);
    if (overrideTenant.organizationId !== base.tenant.organizationId) {
      throw new CloudHostedConfigError('Hosted config tenant mismatch');
    }
  }

  return normalizeHostedRuntimeConfig({
    tenant: base.tenant,
    apiBaseUrl: override.apiBaseUrl ?? base.apiBaseUrl,
    enabledChains: override.enabledChains ?? base.enabledChains,
    enabledTokens: override.enabledTokens ?? base.enabledTokens,
    limits: { ...base.limits, ...(override.limits ?? {}) },
    secretRefs: { ...(base.secretRefs ?? {}), ...(override.secretRefs ?? {}) },
    metadata: { ...(base.metadata ?? {}), ...(override.metadata ?? {}) },
  });
}

export class InMemoryHostedConfigRepository implements HostedConfigRepository {
  private readonly records = new Map<string, HostedRuntimeConfig>();

  constructor(private readonly defaultConfig: Omit<HostedRuntimeConfigInput, 'tenant'> = {}) {}

  getTenantConfig(tenant: CloudTenantContext): HostedRuntimeConfig {
    const normalizedTenant = normalizeCloudTenantContext(tenant);
    return this.records.get(normalizedTenant.organizationId) ?? normalizeHostedRuntimeConfig({ ...this.defaultConfig, tenant: normalizedTenant });
  }

  updateTenantConfig(tenant: CloudTenantContext, updates: Partial<HostedRuntimeConfigInput>): HostedRuntimeConfig {
    const existing = this.getTenantConfig(tenant);
    const updated = mergeHostedRuntimeConfig(existing, updates);
    this.records.set(updated.tenant.organizationId, updated);
    return updated;
  }
}

export class StaticHostedConfigProvider implements HostedConfigProvider {
  constructor(private readonly config: Omit<HostedRuntimeConfigInput, 'tenant'> = {}) {}

  getTenantConfig(tenant: CloudTenantContext): HostedRuntimeConfig {
    return normalizeHostedRuntimeConfig({ ...this.config, tenant });
  }
}

export class DefaultHostedConfigProvider implements HostedConfigProvider {
  constructor(private readonly platformDefaults: Omit<HostedRuntimeConfigInput, 'tenant'> = {}) {}

  getTenantConfig(tenant: CloudTenantContext): HostedRuntimeConfig {
    const normalizedTenant = normalizeCloudTenantContext(tenant);
    const plan = normalizedTenant.plan === 'enterprise' || normalizedTenant.plan === 'pro' || normalizedTenant.plan === 'free'
      ? normalizedTenant.plan
      : 'free';

    return normalizeHostedRuntimeConfig({
      tenant: normalizedTenant,
      enabledChains: [...DEFAULT_HOSTED_ENABLED_CHAINS],
      enabledTokens: [...DEFAULT_HOSTED_ENABLED_TOKENS],
      ...this.platformDefaults,
      limits: {
        ...DEFAULT_HOSTED_PLAN_LIMITS[plan],
        ...(this.platformDefaults.limits ?? {}),
      },
    });
  }
}

export function assertHostedLimit(input: {
  limitName: keyof HostedRuntimeLimits;
  limit: number | null | undefined;
  current: number;
  requested?: number;
  throwOnDeny?: boolean;
}): HostedLimitDecision {
  const requested = input.requested ?? 1;
  const allowed = input.limit == null || input.current + requested <= input.limit;
  const decision: HostedLimitDecision = allowed
    ? {
        allowed,
        limitName: input.limitName,
        limit: input.limit,
        current: input.current,
        requested,
      }
    : {
        allowed,
        limitName: input.limitName,
        limit: input.limit,
        current: input.current,
        requested,
        code: 'HOSTED_LIMIT_EXCEEDED',
        message: `Hosted limit exceeded: ${String(input.limitName)}`,
      };

  if (!allowed && input.throwOnDeny) {
    throw new HostedLimitExceededError(decision);
  }

  return decision;
}

function normalizeHostedSecretRefs(secretRefs: HostedSecretRefs): HostedSecretRefs {
  const normalized: HostedSecretRefs = {};

  for (const [key, value] of Object.entries(secretRefs)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      normalized[key] = value.map((entry) => assertSecretRef(key, entry));
      continue;
    }

    normalized[key] = assertSecretRef(key, value);
  }

  return normalized;
}

function assertSecretRef(key: string, value: string): string {
  if (!value.startsWith('secret://')) {
    throw new CloudHostedConfigError(`Hosted secret ${key} must be a secret:// reference`);
  }
  return value;
}
