import { describe, expect, it } from 'vitest';
import {
  CloudHostedConfigError,
  DefaultHostedConfigProvider,
  HostedLimitExceededError,
  assertHostedLimit,
  mergeHostedRuntimeConfig,
  normalizeHostedRuntimeConfig,
  type HostedRuntimeConfig,
} from '../../src/index.js';

const tenant = { organizationId: 'org-1', plan: 'pro' as const };

describe('Hosted tenant config contract', () => {
  it('provides deterministic plan defaults for free, pro, and enterprise tenants', async () => {
    const provider = new DefaultHostedConfigProvider();

    expect(await provider.getTenantConfig({ organizationId: 'free-org', plan: 'free' })).toMatchObject({
      tenant: { organizationId: 'free-org', tenantId: 'free-org', plan: 'free' },
      enabledChains: ['ethereum-sepolia'],
      limits: {
        monthlyOrderLimit: 100,
        addressPoolLimit: 100,
        webhookEndpointLimit: 1,
        apiKeyLimit: 2,
        paymentLinkLimit: 10,
      },
    });

    expect(await provider.getTenantConfig({ organizationId: 'pro-org', plan: 'pro' })).toMatchObject({
      limits: {
        monthlyOrderLimit: 10000,
        addressPoolLimit: 10000,
        webhookEndpointLimit: 10,
        apiKeyLimit: 10,
        paymentLinkLimit: 1000,
      },
    });

    expect(await provider.getTenantConfig({ organizationId: 'ent-org', plan: 'enterprise' })).toMatchObject({
      limits: {
        monthlyOrderLimit: null,
        addressPoolLimit: null,
        webhookEndpointLimit: null,
        apiKeyLimit: null,
        paymentLinkLimit: null,
      },
    });
  });

  it('merges platform defaults with tenant overrides without changing tenant identity', () => {
    const base: HostedRuntimeConfig = normalizeHostedRuntimeConfig({
      tenant,
      enabledChains: ['ethereum-sepolia'],
      enabledTokens: ['USDC'],
      limits: { monthlyOrderLimit: 10000, webhookEndpointLimit: 10 },
      secretRefs: { webhookSigningSecretRef: 'secret://platform/webhook' },
    });

    const merged = mergeHostedRuntimeConfig(base, {
      tenant,
      enabledChains: ['ethereum-sepolia', 'base-sepolia'],
      limits: { webhookEndpointLimit: 20 },
      metadata: { source: 'tenant-override' },
    });

    expect(merged).toMatchObject({
      tenant: { organizationId: 'org-1', tenantId: 'org-1', plan: 'pro' },
      enabledChains: ['ethereum-sepolia', 'base-sepolia'],
      enabledTokens: ['USDC'],
      secretRefs: { webhookSigningSecretRef: 'secret://platform/webhook' },
      limits: { monthlyOrderLimit: 10000, webhookEndpointLimit: 20 },
      metadata: { source: 'tenant-override' },
    });
  });

  it('rejects tenant override mismatch', () => {
    expect(() => mergeHostedRuntimeConfig(
      normalizeHostedRuntimeConfig({ tenant }),
      { tenant: { organizationId: 'org-2' } }
    )).toThrow('Hosted config tenant mismatch');
  });

  it('rejects raw secret values and allows only secret refs', () => {
    expect(() => normalizeHostedRuntimeConfig({
      tenant,
      secretRefs: { webhookSigningSecretRef: 'secret://tenant/webhook' },
    })).not.toThrow();

    expect(() => normalizeHostedRuntimeConfig({
      tenant,
      secretRefs: { webhookSigningSecretRef: 'whsec_raw_value' },
    })).toThrow(CloudHostedConfigError);
  });

  it('checks enabled chains and tokens per tenant config', () => {
    const config = normalizeHostedRuntimeConfig({
      tenant,
      enabledChains: ['ethereum-sepolia'],
      enabledTokens: ['USDC'],
    });

    expect(config.isChainEnabled('ethereum-sepolia')).toBe(true);
    expect(config.isChainEnabled('base-sepolia')).toBe(false);
    expect(config.isTokenEnabled('USDC')).toBe(true);
    expect(config.isTokenEnabled('USDT')).toBe(false);
  });

  it('returns typed limit allow/deny decisions', () => {
    expect(assertHostedLimit({ limitName: 'apiKeyLimit', limit: 2, current: 1, requested: 1 })).toEqual({
      allowed: true,
      limitName: 'apiKeyLimit',
      limit: 2,
      current: 1,
      requested: 1,
    });

    expect(assertHostedLimit({ limitName: 'apiKeyLimit', limit: 2, current: 2, requested: 1 })).toEqual({
      allowed: false,
      limitName: 'apiKeyLimit',
      limit: 2,
      current: 2,
      requested: 1,
      code: 'HOSTED_LIMIT_EXCEEDED',
      message: 'Hosted limit exceeded: apiKeyLimit',
    });

    expect(() => assertHostedLimit({ limitName: 'apiKeyLimit', limit: 2, current: 2, requested: 1, throwOnDeny: true })).toThrow(HostedLimitExceededError);
  });
});
