import type { CloudTenantContext } from './context.js';

export interface HostedRuntimeConfig {
  tenant: CloudTenantContext;
  apiBaseUrl?: string;
  enabledChains?: string[];
  enabledTokens?: string[];
  webhookSecretRef?: string;
  rpcProviderRefs?: string[];
  limits?: {
    monthlyOrderLimit?: number;
    addressPoolLimit?: number;
    webhookEndpointLimit?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface HostedConfigProvider {
  getTenantConfig(tenant: CloudTenantContext): Promise<HostedRuntimeConfig> | HostedRuntimeConfig;
}

export class StaticHostedConfigProvider implements HostedConfigProvider {
  constructor(private readonly config: Omit<HostedRuntimeConfig, 'tenant'> = {}) {}

  getTenantConfig(tenant: CloudTenantContext): HostedRuntimeConfig {
    return { ...this.config, tenant };
  }
}
