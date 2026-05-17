import { describe, expect, it } from 'vitest';
import {
  CloudApiKeyAuthenticator,
  CloudPaymentLinkService,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudPaymentLinkRepository,
  InMemoryCloudSubscriptionRepository,
  InMemoryUsageMeter,
  RepositoryBackedPaymentLinkPort,
  StaticEntitlementProvider,
  StaticHostedConfigProvider,
  SubscriptionBillingLimitEnforcer,
} from '../../src/index.js';

const tenant = { organizationId: 'org-pl-service', tenantId: 'org-pl-service', plan: 'pro' as const };

function service(overrides: Partial<ConstructorParameters<typeof CloudPaymentLinkService>[0]> = {}) {
  const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
  const auditTrail = new InMemoryCloudAuditTrail();
  const paymentLinks = new RepositoryBackedPaymentLinkPort(new InMemoryCloudPaymentLinkRepository());
  const apiKeys = new InMemoryCloudApiKeyRepository([
    {
      presentedKey: 'pk_live_plinks',
      apiKey: { id: 'key-pl', keyPrefix: 'pk_live_', name: 'Payment links', organizationId: tenant.organizationId, userId: 'user-1', role: 'admin' },
      membership: { role: 'admin', status: 'active' },
      tenant,
    },
  ]);
  return {
    usageMeter,
    auditTrail,
    paymentLinks,
    service: new CloudPaymentLinkService({
      authenticator: new CloudApiKeyAuthenticator(apiKeys),
      entitlementProvider: new StaticEntitlementProvider(['payment-links:create', 'payment-links:update', 'payment-links:read']),
      hostedConfig: new StaticHostedConfigProvider({ enabledChains: ['ethereum-sepolia'], enabledTokens: ['USDC'] }),
      paymentLinks,
      usageMeter,
      auditTrail,
      ...overrides,
    }),
  };
}

describe('CloudPaymentLinkService', () => {
  it('creates payment links through auth/config/adapter/usage/audit', async () => {
    const setup = service();

    const link = await setup.service.createPaymentLink({
      apiKey: 'pk_live_plinks',
      title: 'Hosted Checkout',
      amount: '25.50',
      currency: 'USDC',
      chainOptions: ['ethereum-sepolia'],
      now: new Date('2026-05-16T23:15:00.000Z'),
    });

    expect(link).toMatchObject({ tenant, title: 'Hosted Checkout', status: 'draft' });
    expect(await setup.usageMeter.listUsage({ tenantId: tenant.organizationId })).toMatchObject([
      { type: 'payment_link.created', subjectId: link.id },
    ]);
    expect(await setup.auditTrail.list({ tenantId: tenant.organizationId, action: 'payment-links:create' })).toMatchObject([
      { subjectId: link.id, actor: { type: 'api_key', id: 'key-pl' } },
    ]);
  });

  it('publishes existing tenant-scoped payment links', async () => {
    const setup = service();
    const link = await setup.service.createPaymentLink({ apiKey: 'pk_live_plinks', title: 'Hosted Checkout', amount: '25.50', currency: 'USDC', chainOptions: ['ethereum-sepolia'] });

    const published = await setup.service.publishPaymentLink({ apiKey: 'pk_live_plinks', paymentLinkId: link.id, slug: 'hosted-checkout' });

    expect(published).toMatchObject({ id: link.id, status: 'published', slug: 'hosted-checkout' });
    expect(await setup.auditTrail.list({ tenantId: tenant.organizationId, action: 'payment-links:update' })).toMatchObject([
      { subjectId: link.id, actor: { type: 'api_key', id: 'key-pl' } },
    ]);
  });

  it('rejects disabled chain options before adapter side effects', async () => {
    const setup = service();

    await expect(setup.service.createPaymentLink({
      apiKey: 'pk_live_plinks',
      title: 'Bad Checkout',
      amount: '25.50',
      currency: 'USDC',
      chainOptions: ['base-sepolia'],
    })).rejects.toThrow('Chain base-sepolia is not enabled for this tenant');

    await expect(setup.paymentLinks.list(tenant)).resolves.toHaveLength(0);
  });

  it('reads and lists tenant-scoped payment links through read entitlement', async () => {
    const setup = service();
    const link = await setup.service.createPaymentLink({ apiKey: 'pk_live_plinks', title: 'Hosted Checkout', amount: '25.50', currency: 'USDC', chainOptions: ['ethereum-sepolia'] });

    await expect(setup.service.getPaymentLink({ apiKey: 'pk_live_plinks', paymentLinkId: link.id })).resolves.toMatchObject({ id: link.id, tenant });
    await expect(setup.service.listPaymentLinks({ apiKey: 'pk_live_plinks', status: 'draft' })).resolves.toMatchObject([{ id: link.id, status: 'draft' }]);
  });

  it('rejects missing read entitlement before returning payment links', async () => {
    const setup = service({ entitlementProvider: new StaticEntitlementProvider(['payment-links:create']) });
    const link = await setup.service.createPaymentLink({ apiKey: 'pk_live_plinks', title: 'Hosted Checkout', amount: '25.50', currency: 'USDC', chainOptions: ['ethereum-sepolia'] });

    await expect(setup.service.getPaymentLink({ apiKey: 'pk_live_plinks', paymentLinkId: link.id })).rejects.toThrow('Tenant is not entitled to capability: payment-links:read');
  });

  it('enforces subscription payment-link limits before adapter side effects', async () => {
    const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
    await usageMeter.recordUsage({ tenant, type: 'payment_link.created', subjectId: 'existing-link', occurredAt: new Date('2026-05-16T00:00:00.000Z') });
    const setup = service({
      usageMeter,
      billingLimitEnforcer: new SubscriptionBillingLimitEnforcer({
        subscriptions: new InMemoryCloudSubscriptionRepository([{ tenant, status: 'active', plan: 'pro', limits: { paymentLinkLimit: 1 } }]),
        usage: usageMeter,
      }),
    });

    await expect(setup.service.createPaymentLink({
      apiKey: 'pk_live_plinks',
      title: 'Limited Checkout',
      amount: '25.50',
      currency: 'USDC',
      chainOptions: ['ethereum-sepolia'],
      now: new Date('2026-05-17T00:00:00.000Z'),
    })).rejects.toThrow('Subscription usage limit exceeded: paymentLinkLimit');

    await expect(setup.paymentLinks.list(tenant)).resolves.toHaveLength(0);
  });
});
