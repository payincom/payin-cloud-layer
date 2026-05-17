import type { CloudAuditTrail, CloudAuditTrailEvent } from '../audit-risk.js';
import { CloudApiKeyAuthenticator, type CloudApiKeyScope } from '../api-key.js';
import type { CloudCapability, EntitlementProvider } from '../entitlements.js';

export interface CloudAuditServiceOptions {
  authenticator: CloudApiKeyAuthenticator;
  entitlementProvider: EntitlementProvider;
  auditTrail: CloudAuditTrail;
}

export interface CloudAuditEventListServiceRequest {
  apiKey: string;
  action?: CloudCapability;
  actorId?: string;
}

export class CloudAuditService {
  constructor(private readonly options: CloudAuditServiceOptions) {}

  async listEvents(request: CloudAuditEventListServiceRequest): Promise<CloudAuditTrailEvent[]> {
    const scope = await this.authenticateAndAuthorize(request.apiKey, 'config:read');
    return this.options.auditTrail.list({
      tenantId: scope.tenant.organizationId,
      action: request.action,
      actorId: request.actorId,
    }) as Promise<CloudAuditTrailEvent[]>;
  }

  private async authenticateAndAuthorize(apiKey: string, capability: Extract<CloudCapability, 'config:read'>): Promise<CloudApiKeyScope> {
    const scope = await this.options.authenticator.authenticate(apiKey);
    await this.options.authenticator.assertCapability(scope, capability);
    await this.options.entitlementProvider.assertAllowed(scope.tenant, capability);
    return scope;
  }
}
