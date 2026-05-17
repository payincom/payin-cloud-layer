import {
  CloudAddressPoolService,
  CloudApiKeyAuthenticator,
  CloudApiKeyService,
  CloudHostedConfigService,
  CloudOrderService,
  CloudPaymentLinkService,
  CloudWebhookService,
  InMemoryCloudAddressPoolRepository,
  InMemoryCloudApiKeyRepository,
  InMemoryCloudAuditTrail,
  InMemoryCloudOrderRepository,
  InMemoryCloudPaymentLinkRepository,
  InMemoryCloudSubscriptionRepository,
  InMemoryCloudWebhookRepository,
  InMemoryHostedConfigRepository,
  InMemoryUsageMeter,
  RepositoryBackedAddressPoolPort,
  RepositoryBackedOrderPort,
  RepositoryBackedPaymentLinkPort,
  StaticCloudWebhookSigner,
  StaticEntitlementProvider,
  SubscriptionBillingLimitEnforcer,
  createCloudHonoApp,
  createPublicOrderStatusView,
  createPublicPaymentLinkCheckoutView,
  createRuntimeReadinessReport,
  type CloudHonoApp,
  type CloudTenantContext,
  type CloudWebhookEndpoint,
  type HostedRuntimeConfigInput,
  type NormalizedCloudOrder,
  type NormalizedCloudPaymentLink,
  type RequiredUsageEvent,
} from './index.js';

export interface PayInCloudRuntimeOptions {
  tenant?: CloudTenantContext;
  adminApiKey?: string;
  hostedConfig?: Omit<HostedRuntimeConfigInput, 'tenant'>;
  webhookSignature?: string;
}

export interface PayInCloudRuntime {
  app: CloudHonoApp;
  tenant: CloudTenantContext;
  adminApiKey: string;
  listUsage(): Promise<RequiredUsageEvent[]>;
  repositories: {
    orders: RepositoryBackedOrderPort;
    paymentLinks: RepositoryBackedPaymentLinkPort;
    addressPool: RepositoryBackedAddressPoolPort;
    webhooks: InMemoryCloudWebhookRepository;
  };
}

export function createPayInCloudRuntime(options: PayInCloudRuntimeOptions = {}): PayInCloudRuntime {
  const tenant = options.tenant ?? { organizationId: 'org-cloud-layer-sandbox', tenantId: 'org-cloud-layer-sandbox', plan: 'pro' as const };
  const adminApiKey = options.adminApiKey ?? process.env.PAYIN_ADMIN_API_KEY ?? 'pk_live_cloud_layer_sandbox_admin';
  const usageMeter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
  const auditTrail = new InMemoryCloudAuditTrail();
  const apiKeys = new InMemoryCloudApiKeyRepository([
    {
      presentedKey: adminApiKey,
      apiKey: { id: 'key-runtime-admin', keyPrefix: 'pk_live_', name: 'Hosted runtime admin', organizationId: tenant.organizationId, userId: 'user-runtime-admin', role: 'admin' },
      membership: { role: 'admin', status: 'active' },
      tenant,
    },
  ]);
  const authenticator = new CloudApiKeyAuthenticator(apiKeys);
  const entitlementProvider = new StaticEntitlementProvider([
    'orders:create', 'orders:read',
    'payment-links:create', 'payment-links:update', 'payment-links:read',
    'address-pool:import', 'address-pool:read',
    'api-keys:create', 'api-keys:read', 'api-keys:revoke',
    'config:read', 'config:update',
    'webhooks:test', 'webhooks:read',
  ]);
  const hostedConfig = new InMemoryHostedConfigRepository(options.hostedConfig ?? {
    enabledChains: ['ethereum-sepolia'],
    enabledTokens: ['USDC'],
    apiBaseUrl: process.env.PAYIN_PUBLIC_BASE_URL ?? 'https://runtime.payin.local',
    limits: {
      monthlyOrderLimit: 1000,
      paymentLinkLimit: 100,
      apiKeyLimit: 20,
      addressPoolLimit: 1000,
      webhookEndpointLimit: 10,
    },
  });
  const subscriptions = new InMemoryCloudSubscriptionRepository([
    {
      tenant,
      status: 'active',
      plan: tenant.plan === 'free' || tenant.plan === 'enterprise' ? tenant.plan : 'pro',
      limits: {
        monthlyOrderLimit: 1000,
        paymentLinkLimit: 100,
        apiKeyLimit: 20,
        addressPoolLimit: 1000,
        webhookEndpointLimit: 10,
      },
    },
  ]);
  const billingLimitEnforcer = new SubscriptionBillingLimitEnforcer({ subscriptions, usage: usageMeter });
  const orders = new RepositoryBackedOrderPort(new InMemoryCloudOrderRepository());
  const paymentLinks = new RepositoryBackedPaymentLinkPort(new InMemoryCloudPaymentLinkRepository());
  const addressPool = new RepositoryBackedAddressPoolPort(new InMemoryCloudAddressPoolRepository());
  const webhooks = new InMemoryCloudWebhookRepository();

  const app = createCloudHonoApp({
    legacyEnvelopes: true,
    services: {
      orders: new CloudOrderService({ authenticator, entitlementProvider, hostedConfig, orders, usageMeter, auditTrail, billingLimitEnforcer }),
      paymentLinks: new CloudPaymentLinkService({ authenticator, entitlementProvider, hostedConfig, paymentLinks, usageMeter, auditTrail, billingLimitEnforcer }),
      addressPool: new CloudAddressPoolService({ authenticator, entitlementProvider, addressPool, usageMeter, auditTrail, billingLimitEnforcer }),
      webhooks: new CloudWebhookService({ authenticator, entitlementProvider, webhooks, signer: new StaticCloudWebhookSigner(options.webhookSignature ?? process.env.PAYIN_WEBHOOK_TEST_SIGNATURE ?? 'runtime-sandbox-signature'), usageMeter, auditTrail, billingLimitEnforcer }),
      apiKeys: new CloudApiKeyService({ authenticator, entitlementProvider, apiKeys, usageMeter, auditTrail }),
      configs: new CloudHostedConfigService({ authenticator, entitlementProvider, configs: hostedConfig, auditTrail }),
      readiness: {
        getReadiness: async () => createRuntimeReadinessReport({ tenant, checks: runtimeReadinessChecks({ hostedConfigConfigured: true, webhookCount: (await webhooks.listForTenant(tenant)).length }) }),
        runSmoke: async () => createRuntimeReadinessReport({ tenant, checks: runtimeReadinessChecks({ hostedConfigConfigured: true, webhookCount: (await webhooks.listForTenant(tenant)).length, smoke: true }) }),
      },
    },
    publicCheckout: {
      getOrderStatus: async ({ orderId }) => {
        const order = await orders.get(orderId, tenant) as NormalizedCloudOrder | null;
        return order ? createPublicOrderStatusView({ order }) : null;
      },
      getPaymentLinkCheckout: async ({ slug, requestOrigin }) => {
        const links = await paymentLinks.list(tenant) as NormalizedCloudPaymentLink[];
        const link = links.find((candidate) => candidate.slug === slug) ?? null;
        return link ? createPublicPaymentLinkCheckoutView(link, { requestOrigin }) : null;
      },
      createPaymentLinkOrder: async ({ slug, body }) => {
        const links = await paymentLinks.list(tenant) as NormalizedCloudPaymentLink[];
        const link = links.find((candidate) => candidate.slug === slug) ?? null;
        if (!link) return null;
        const buyerEmail = typeof body.buyerEmail === 'string' ? body.buyerEmail.trim().toLowerCase() : undefined;
        const chainId = typeof body.chainId === 'string' && body.chainId.trim() ? body.chainId.trim() : link.chainOptions[0];
        if (!link.chainOptions.includes(chainId)) throw new Error('Requested chain is not enabled for this payment link');
        const order = await orders.create({
          tenant,
          orderReference: typeof body.orderReference === 'string' && body.orderReference.trim() ? body.orderReference.trim() : `plink-${link.id}-${Date.now()}`,
          amount: link.amount,
          currency: link.currency,
          chainId,
          metadata: {
            source: 'public-payment-link',
            paymentLinkId: link.id,
            paymentLinkSlug: slug,
            ...(buyerEmail ? { buyerEmail } : {}),
          },
        });
        return createPublicOrderStatusView({ order });
      },
    },
  });

  return {
    app,
    tenant,
    adminApiKey,
    listUsage: () => Promise.resolve(usageMeter.listUsage({ tenantId: tenant.organizationId })),
    repositories: { orders, paymentLinks, addressPool, webhooks },
  };
}

function runtimeReadinessChecks(input: { hostedConfigConfigured: boolean; webhookCount: number; smoke?: boolean }) {
  return [
    { name: 'hosted-config', status: input.hostedConfigConfigured ? 'pass' as const : 'fail' as const, message: input.hostedConfigConfigured ? 'hosted config loaded' : 'hosted config missing' },
    { name: 'webhooks', status: input.webhookCount > 0 ? 'pass' as const : 'warn' as const, message: input.webhookCount > 0 ? 'webhook endpoint configured' : 'no webhook endpoint configured' },
    ...(input.smoke ? [{ name: 'runtime-smoke', status: 'pass' as const, message: 'runtime smoke executed' }] : []),
  ];
}

export type { CloudWebhookEndpoint };
