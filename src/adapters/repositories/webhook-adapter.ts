import { normalizeCloudWebhookEndpoint, type CloudWebhookEndpoint, type CloudWebhookEndpointInput, type CloudWebhookEndpointRepository } from '../../webhooks.js';
import type { CloudTenantContext } from '../../context.js';

export interface MutableCloudWebhookEndpointRepository extends CloudWebhookEndpointRepository {
  upsert(input: CloudWebhookEndpointInput): Promise<CloudWebhookEndpoint> | CloudWebhookEndpoint;
  deleteForTenant?(endpointId: string, tenant: CloudTenantContext): Promise<boolean> | boolean;
}

export class InMemoryCloudWebhookRepository implements MutableCloudWebhookEndpointRepository {
  private readonly records = new Map<string, CloudWebhookEndpoint>();

  upsert(input: CloudWebhookEndpointInput): CloudWebhookEndpoint {
    const endpoint = normalizeCloudWebhookEndpoint(input);
    this.records.set(endpoint.id, endpoint);
    return endpoint;
  }

  async listForTenant(tenant: CloudTenantContext): Promise<CloudWebhookEndpoint[]> {
    return [...this.records.values()].filter((endpoint) => endpoint.tenant.organizationId === tenant.organizationId);
  }

  async getForTenant(endpointId: string, tenant: CloudTenantContext): Promise<CloudWebhookEndpoint | null> {
    const endpoint = this.records.get(endpointId);
    return endpoint?.tenant.organizationId === tenant.organizationId ? endpoint : null;
  }

  async deleteForTenant(endpointId: string, tenant: CloudTenantContext): Promise<boolean> {
    const endpoint = await this.getForTenant(endpointId, tenant);
    if (!endpoint) return false;
    return this.records.delete(endpointId);
  }
}
