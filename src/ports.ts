import type { CloudApiKeyRepository } from './api-key.js';
import type { CloudTenantResolver } from './tenant-resolver.js';
import type { HostedConfigProvider } from './hosted-config.js';
import type { CloudAuditTrail } from './audit-risk.js';
import type { UsageMeter } from './usage-meter.js';
import type { CloudWebhookEndpointRepository } from './webhooks.js';
import type { CloudTenantContext, NormalizedCloudTenantContext } from './context.js';
import { resolveActiveCloudTenant } from './tenant-resolver.js';

export interface CloudOrderPort {
  create(request: unknown): Promise<unknown> | unknown;
  get(orderId: string, tenant: CloudTenantContext): Promise<unknown> | unknown;
  list(tenant: CloudTenantContext, filters?: Record<string, unknown>): Promise<unknown> | unknown;
}

export interface CloudPaymentLinkPort {
  create(request: unknown): Promise<unknown> | unknown;
  get(paymentLinkId: string, tenant: CloudTenantContext): Promise<unknown> | unknown;
  list(tenant: CloudTenantContext, filters?: Record<string, unknown>): Promise<unknown> | unknown;
  update(paymentLinkId: string, tenant: CloudTenantContext, updates: Record<string, unknown>): Promise<unknown> | unknown;
}

export interface CloudAddressPoolPort {
  import(request: unknown): Promise<unknown> | unknown;
  list?(tenant: CloudTenantContext, filters?: Record<string, unknown>): Promise<unknown> | unknown;
  summary(tenant: CloudTenantContext): Promise<unknown> | unknown;
}

export interface CloudLayerPorts {
  tenantResolver: CloudTenantResolver;
  apiKeys: CloudApiKeyRepository;
  hostedConfig: HostedConfigProvider;
  orders: CloudOrderPort;
  paymentLinks: CloudPaymentLinkPort;
  addressPool: CloudAddressPoolPort;
  webhooks: CloudWebhookEndpointRepository;
  auditTrail: CloudAuditTrail;
  usageMeter: UsageMeter;
}

const REQUIRED_PORTS: Array<keyof CloudLayerPorts> = [
  'tenantResolver',
  'apiKeys',
  'hostedConfig',
  'orders',
  'paymentLinks',
  'addressPool',
  'webhooks',
  'auditTrail',
  'usageMeter',
];

export class CloudLayerPortError extends Error {
  readonly code = 'CLOUD_LAYER_PORT_MISSING';

  constructor(message: string) {
    super(message);
    this.name = 'CloudLayerPortError';
  }
}

export function createCloudLayerPorts(ports: Partial<CloudLayerPorts>): CloudLayerPorts {
  for (const port of REQUIRED_PORTS) {
    if (!ports[port]) {
      throw new CloudLayerPortError(`Cloud layer port ${port} is required`);
    }
  }
  return ports as CloudLayerPorts;
}

export class CloudLayerApplication {
  constructor(readonly ports: CloudLayerPorts) {}

  resolveTenantForUser(userId: string, organizationId: string): Promise<NormalizedCloudTenantContext> {
    return resolveActiveCloudTenant(this.ports.tenantResolver, userId, organizationId);
  }
}
