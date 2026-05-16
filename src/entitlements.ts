import type { CloudTenantContext } from './context.js';

export type CloudCapability =
  | 'orders:create'
  | 'orders:read'
  | 'payment-links:create'
  | 'payment-links:update'
  | 'payment-links:read'
  | 'api-keys:create'
  | 'api-keys:read'
  | 'api-keys:revoke'
  | 'address-pool:import'
  | 'address-pool:read'
  | 'webhooks:test'
  | 'webhooks:read'
  | 'config:read'
  | 'config:update';

export class EntitlementDeniedError extends Error {
  readonly code = 'CLOUD_ENTITLEMENT_DENIED';

  constructor(
    public readonly tenant: CloudTenantContext,
    public readonly capability: CloudCapability,
    message = `Tenant is not entitled to capability: ${capability}`
  ) {
    super(message);
    this.name = 'EntitlementDeniedError';
  }
}

export interface EntitlementProvider {
  assertAllowed(context: CloudTenantContext, capability: CloudCapability): Promise<void> | void;
}

export class AllowAllEntitlements implements EntitlementProvider {
  assertAllowed(): void {
    // Dev/test implementation. Production Cloud should inject a real policy provider.
  }
}

export class StaticEntitlementProvider implements EntitlementProvider {
  private readonly allowedCapabilities: Set<CloudCapability>;

  constructor(allowedCapabilities: Iterable<CloudCapability>) {
    this.allowedCapabilities = new Set(allowedCapabilities);
  }

  assertAllowed(context: CloudTenantContext, capability: CloudCapability): void {
    if (!this.allowedCapabilities.has(capability)) {
      throw new EntitlementDeniedError(context, capability);
    }
  }
}
