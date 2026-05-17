import { createCloudAuditEvent, type CloudAuditTrail } from '../audit-risk.js';
import { CloudApiKeyAuthenticator, type CloudApiKeyScope } from '../api-key.js';
import { type EntitlementProvider } from '../entitlements.js';
import type { HostedConfigRepository, HostedRuntimeConfig, HostedRuntimeConfigInput } from '../hosted-config.js';

export interface CloudHostedConfigServiceOptions {
  authenticator: CloudApiKeyAuthenticator;
  entitlementProvider: EntitlementProvider;
  configs: HostedConfigRepository;
  auditTrail: CloudAuditTrail;
}

export interface CloudHostedConfigGetServiceRequest { apiKey: string }
export interface CloudHostedConfigUpdateServiceRequest extends Partial<Omit<HostedRuntimeConfigInput, 'tenant'>> { apiKey: string; now?: Date }

export class CloudHostedConfigService {
  constructor(private readonly options: CloudHostedConfigServiceOptions) {}

  async getConfig(request: CloudHostedConfigGetServiceRequest): Promise<HostedRuntimeConfig> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'config:read');
    return this.options.configs.getTenantConfig(scope.tenant);
  }

  async updateConfig(request: CloudHostedConfigUpdateServiceRequest): Promise<HostedRuntimeConfig> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'config:update');
    const { apiKey: _apiKey, now, ...updates } = request;
    void _apiKey;
    const config = await this.options.configs.updateTenantConfig(scope.tenant, updates);
    await this.options.auditTrail.record(createCloudAuditEvent({
      tenant: scope.tenant,
      action: 'config:update',
      actor: { type: 'api_key', id: scope.apiKeyId },
      subjectId: scope.tenant.organizationId,
      occurredAt: now,
      metadata: { resource: 'hosted_config' },
    }));
    return config;
  }

  private async authenticateAndAuthorize(apiKey: string, capability: 'config:read' | 'config:update'): Promise<CloudApiKeyScope> {
    const scope = await this.options.authenticator.authenticate(apiKey);
    await this.options.authenticator.assertCapability(scope, capability);
    await this.options.entitlementProvider.assertAllowed(scope.tenant, capability);
    return scope;
  }
}
