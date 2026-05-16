import { describe, expect, it, vi } from 'vitest';
import {
  CloudLayerApplication,
  createCloudLayerPorts,
  type CloudLayerPorts,
} from '../../src/index.js';

const tenant = { organizationId: 'org-app', tenantId: 'org-app' };

function ports(): CloudLayerPorts {
  return createCloudLayerPorts({
    tenantResolver: { resolveForUser: vi.fn(async () => ({ userId: 'user-1', tenant, role: 'admin', status: 'active' })) },
    apiKeys: { findByPresentedKey: vi.fn(async () => ({ apiKey: null })) },
    hostedConfig: { getTenantConfig: vi.fn(async () => ({ tenant, enabledChains: [], enabledTokens: [], limits: {}, isChainEnabled: () => false, isTokenEnabled: () => false })) },
    orders: { create: vi.fn(), get: vi.fn(), list: vi.fn() },
    paymentLinks: { create: vi.fn(), get: vi.fn(), list: vi.fn(), update: vi.fn() },
    addressPool: { import: vi.fn(), summary: vi.fn() },
    webhooks: { listForTenant: vi.fn(), getForTenant: vi.fn() },
    auditTrail: { record: vi.fn(), list: vi.fn() },
    usageMeter: { recordUsage: vi.fn(), listUsage: vi.fn() },
  });
}

describe('Cloud adapter ports contract', () => {
  it('creates an explicit adapter port bundle without importing old Cloud implementation', () => {
    const bundle = ports();

    expect(bundle).toHaveProperty('tenantResolver');
    expect(bundle).toHaveProperty('apiKeys');
    expect(bundle).toHaveProperty('orders');
    expect(bundle).toHaveProperty('paymentLinks');
    expect(bundle).toHaveProperty('addressPool');
    expect(bundle).toHaveProperty('webhooks');
    expect(bundle).toHaveProperty('auditTrail');
    expect(bundle).toHaveProperty('usageMeter');
  });

  it('fails fast when a required adapter port is missing', () => {
    expect(() => createCloudLayerPorts({ orders: {} } as never)).toThrow('Cloud layer port tenantResolver is required');
  });

  it('provides an application facade over the explicit ports', async () => {
    const bundle = ports();
    const app = new CloudLayerApplication(bundle);

    await expect(app.resolveTenantForUser('user-1', 'org-app')).resolves.toEqual(tenant);
    expect(bundle.tenantResolver.resolveForUser).toHaveBeenCalledWith('user-1', 'org-app');
  });
});
