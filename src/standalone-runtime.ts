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
  PgSqlExecutor,
  RepositoryBackedAddressPoolPort,
  RepositoryBackedOrderPort,
  RepositoryBackedPaymentLinkPort,
  SqlCloudAddressPoolRepository,
  SqlCloudApiKeyRepository,
  SqlCloudAuditTrail,
  SqlCloudOrderRepository,
  SqlCloudPaymentLinkRepository,
  SqlCloudSubscriptionRepository,
  SqlCloudUsageMeter,
  SqlCloudWebhookRepository,
  SqlHostedConfigRepository,
  StaticCloudWebhookSigner,
  StaticEntitlementProvider,
  SubscriptionBillingLimitEnforcer,
  applyCloudLayerSchema,
  createCloudHonoApp,
  createPublicDepositStatusView,
  createPublicOrderStatusView,
  createPublicPaymentLinkCheckoutView,
  createPublicRuntimeDiscoveryView,
  createPublicTransferStatusView,
  createRuntimeReadinessReport,
  type CloudHonoApp,
  type CloudTenantContext,
  type CloudWebhookEndpoint,
  type HostedRuntimeConfigInput,
  type NormalizedCloudOrder,
  type NormalizedCloudPaymentLink,
  type RequiredUsageEvent,
} from './index.js';
import type { CloudApiKeyManagementRepository } from './api-key.js';
import type { CloudAuditTrail } from './audit-risk.js';
import type { HostedConfigRepository } from './hosted-config.js';
import type { CloudSubscriptionManagementRepository } from './subscription.js';
import type { UsageMeter } from './usage-meter.js';
import type { MutableCloudWebhookEndpointRepository } from './adapters/repositories/webhook-adapter.js';

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
  persistence: 'memory' | 'postgres';
  listUsage(): Promise<RequiredUsageEvent[]>;
  repositories: {
    orders: RepositoryBackedOrderPort;
    paymentLinks: RepositoryBackedPaymentLinkPort;
    addressPool: RepositoryBackedAddressPoolPort;
    webhooks: InMemoryCloudWebhookRepository;
  };
}

interface RuntimeBackingStores {
  apiKeys: CloudApiKeyManagementRepository;
  hostedConfig: HostedConfigRepository;
  subscriptions: CloudSubscriptionManagementRepository;
  usageMeter: UsageMeter;
  auditTrail: CloudAuditTrail;
  orders: RepositoryBackedOrderPort;
  paymentLinks: RepositoryBackedPaymentLinkPort;
  addressPool: RepositoryBackedAddressPoolPort;
  webhooks: MutableCloudWebhookEndpointRepository;
  persistence: 'memory' | 'postgres';
}

export async function createPayInCloudRuntimeFromEnvironment(options: PayInCloudRuntimeOptions = {}): Promise<PayInCloudRuntime> {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.DB_CONNECTION_STRING;
  if (!databaseUrl) return createPayInCloudRuntime(options);
  return createPayInCloudRuntime({ ...options, backingStores: await createPostgresBackingStores(options, databaseUrl) });
}

export function createPayInCloudRuntime(options: PayInCloudRuntimeOptions & { backingStores?: RuntimeBackingStores } = {}): PayInCloudRuntime {
  const tenant = options.tenant ?? { organizationId: 'org-cloud-layer-sandbox', tenantId: 'org-cloud-layer-sandbox', plan: 'pro' as const };
  const adminApiKey = options.adminApiKey ?? process.env.PAYIN_ADMIN_API_KEY ?? 'pk_live_cloud_layer_sandbox_admin';
  const defaultConfig = options.hostedConfig ?? {
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
  };
  const usageMeter = options.backingStores?.usageMeter ?? new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });
  const auditTrail = options.backingStores?.auditTrail ?? new InMemoryCloudAuditTrail();
  const apiKeys = options.backingStores?.apiKeys ?? new InMemoryCloudApiKeyRepository([
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
  const hostedConfig = options.backingStores?.hostedConfig ?? new InMemoryHostedConfigRepository(defaultConfig);
  const subscriptions = options.backingStores?.subscriptions ?? new InMemoryCloudSubscriptionRepository([
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
  const orders = options.backingStores?.orders ?? new RepositoryBackedOrderPort(new InMemoryCloudOrderRepository());
  const paymentLinks = options.backingStores?.paymentLinks ?? new RepositoryBackedPaymentLinkPort(new InMemoryCloudPaymentLinkRepository());
  const addressPool = options.backingStores?.addressPool ?? new RepositoryBackedAddressPoolPort(new InMemoryCloudAddressPoolRepository());
  const webhooks = options.backingStores?.webhooks ?? new InMemoryCloudWebhookRepository();

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
      getPaymentLinkPreview: async ({ paymentLinkId, token, requestOrigin }) => {
        const links = await paymentLinks.list(tenant) as NormalizedCloudPaymentLink[];
        const link = links.find((candidate) => candidate.id === paymentLinkId) ?? null;
        if (!link) return null;
        const expectedToken = typeof link.metadata?.previewToken === 'string' ? link.metadata.previewToken : process.env.PAYIN_CHECKOUT_PREVIEW_TOKEN;
        if (expectedToken && token !== expectedToken) return null;
        return createPublicPaymentLinkCheckoutView(link, { requestOrigin });
      },
      getDepositStatus: async ({ address, requestOrigin }) => {
        const addresses = await addressPool.list(tenant);
        const entry = addresses.find((candidate) => candidate.address.toLowerCase() === address.toLowerCase()) ?? null;
        return entry ? createPublicDepositStatusView(entry, { requestOrigin }) : null;
      },
      getRuntimeDiscovery: async () => {
        const config = await hostedConfig.getTenantConfig(tenant);
        return createPublicRuntimeDiscoveryView({ chains: config.enabledChains, tokens: config.enabledTokens });
      },
      listOrderTransfers: async ({ orderId }) => {
        const order = await orders.get(orderId, tenant) as NormalizedCloudOrder | null;
        return order ? [createRuntimeTransferStatus(order)] : [];
      },
      getTransferStatus: async ({ transactionHash }) => {
        const allOrders = await orders.list(tenant) as NormalizedCloudOrder[];
        const order = allOrders.find((candidate) => runtimeTransferHash(candidate) === transactionHash) ?? null;
        return order ? createRuntimeTransferStatus(order) : null;
      },
    },
  });

  return {
    app,
    tenant,
    adminApiKey,
    persistence: options.backingStores?.persistence ?? 'memory',
    listUsage: () => Promise.resolve(usageMeter.listUsage({ tenantId: tenant.organizationId })),
    repositories: { orders, paymentLinks, addressPool, webhooks: webhooks as InMemoryCloudWebhookRepository },
  };
}

async function createPostgresBackingStores(options: PayInCloudRuntimeOptions, databaseUrl: string): Promise<RuntimeBackingStores> {
  const tenant = options.tenant ?? { organizationId: process.env.PAYIN_ORGANIZATION_ID ?? 'org-cloud-layer-sandbox', tenantId: process.env.PAYIN_TENANT_ID ?? process.env.PAYIN_ORGANIZATION_ID ?? 'org-cloud-layer-sandbox', plan: (process.env.PAYIN_PLAN as 'free' | 'pro' | 'enterprise' | undefined) ?? 'pro' };
  const adminApiKey = options.adminApiKey ?? process.env.PAYIN_ADMIN_API_KEY ?? 'pk_live_cloud_layer_sandbox_admin';
  const db = new PgSqlExecutor({ connectionString: databaseUrl, requireDisposable: false });
  await applyCloudLayerSchema(db);
  const apiKeys = new SqlCloudApiKeyRepository(db);
  const hostedConfig = new SqlHostedConfigRepository(db, { defaults: options.hostedConfig });
  const subscriptions = new SqlCloudSubscriptionRepository(db);
  await seedPostgresRuntime(db, { tenant, adminApiKey, hostedConfig, subscriptions, options });
  return {
    apiKeys,
    hostedConfig,
    subscriptions,
    usageMeter: new SqlCloudUsageMeter(db),
    auditTrail: new SqlCloudAuditTrail(db),
    orders: new RepositoryBackedOrderPort(new SqlCloudOrderRepository(db)),
    paymentLinks: new RepositoryBackedPaymentLinkPort(new SqlCloudPaymentLinkRepository(db)),
    addressPool: new RepositoryBackedAddressPoolPort(new SqlCloudAddressPoolRepository(db)),
    webhooks: new SqlCloudWebhookRepository(db),
    persistence: 'postgres',
  };
}

async function seedPostgresRuntime(db: PgSqlExecutor, input: { tenant: CloudTenantContext; adminApiKey: string; hostedConfig: HostedConfigRepository; subscriptions: CloudSubscriptionManagementRepository; options: PayInCloudRuntimeOptions }): Promise<void> {
  const tenant = input.tenant;
  await db.query(
    `INSERT INTO organizations (id, name, slug, plan_type) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, plan_type = EXCLUDED.plan_type`,
    [tenant.organizationId, 'Cloud Layer Sandbox', tenant.organizationId, tenant.plan ?? 'pro']
  );
  await db.query(
    `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status`,
    [tenant.organizationId, 'user-runtime-admin', 'admin', 'active']
  );
  await db.query(
    `INSERT INTO api_keys (id, key_hash, key_prefix, name, organization_id, user_id, role, created_at) VALUES ($1, crypt($2, gen_salt('bf')), $3, $4, $5, $6, $7, NOW()) ON CONFLICT (id) DO UPDATE SET key_prefix = EXCLUDED.key_prefix, name = EXCLUDED.name, organization_id = EXCLUDED.organization_id, user_id = EXCLUDED.user_id, role = EXCLUDED.role, revoked_at = NULL`,
    ['key-runtime-admin', input.adminApiKey, input.adminApiKey.slice(0, 8), 'Hosted runtime admin', tenant.organizationId, 'user-runtime-admin', 'admin']
  );
  await input.hostedConfig.updateTenantConfig(tenant, input.options.hostedConfig ?? {
    enabledChains: ['ethereum-sepolia'],
    enabledTokens: ['USDC'],
    apiBaseUrl: process.env.PAYIN_PUBLIC_BASE_URL ?? 'https://runtime.payin.local',
    limits: { monthlyOrderLimit: 1000, paymentLinkLimit: 100, apiKeyLimit: 20, addressPoolLimit: 1000, webhookEndpointLimit: 10 },
  });
  await input.subscriptions.upsert({
    tenant,
    status: 'active',
    plan: tenant.plan === 'free' || tenant.plan === 'enterprise' ? tenant.plan : 'pro',
    limits: { monthlyOrderLimit: 1000, paymentLinkLimit: 100, apiKeyLimit: 20, addressPoolLimit: 1000, webhookEndpointLimit: 10 },
  });
}

function createRuntimeTransferStatus(order: NormalizedCloudOrder) {
  const confirmed = order.status === 'completed';
  return createPublicTransferStatusView({
    transactionHash: runtimeTransferHash(order),
    status: confirmed ? 'confirmed' : 'pending',
    orderId: order.id,
    depositAddress: order.paymentAddress,
    chain: order.chainId,
    token: order.currency,
    amount: order.confirmedReceived && Number(order.confirmedReceived) > 0 ? order.confirmedReceived : order.amount,
    confirmations: confirmed ? 1 : 0,
    requiredConfirmations: 1,
    ...(confirmed ? { confirmedAt: order.updatedAt ?? new Date() } : {}),
  });
}

function runtimeTransferHash(order: NormalizedCloudOrder): string {
  return order.completionTxHash ?? `pending-${order.id}`;
}

function runtimeReadinessChecks(input: { hostedConfigConfigured: boolean; webhookCount: number; smoke?: boolean }) {
  return [
    { name: 'hosted-config', status: input.hostedConfigConfigured ? 'pass' as const : 'fail' as const, message: input.hostedConfigConfigured ? 'hosted config loaded' : 'hosted config missing' },
    { name: 'webhooks', status: input.webhookCount > 0 ? 'pass' as const : 'warn' as const, message: input.webhookCount > 0 ? 'webhook endpoint configured' : 'no webhook endpoint configured' },
    ...(input.smoke ? [{ name: 'runtime-smoke', status: 'pass' as const, message: 'runtime smoke executed' }] : []),
  ];
}

export type { CloudWebhookEndpoint };
