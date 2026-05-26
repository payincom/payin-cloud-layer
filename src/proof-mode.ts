import type { Context, Hono, Next } from 'hono';
import type { CloudControlPlaneProvider } from './cloud-control-plane-contracts.js';

type Protocol = 'evm' | 'tron' | 'solana';
type AddressStatus = 'available' | 'bound' | 'allocated' | 'archived';

interface ProofCredentials {
  email: string;
  password: string;
}

interface ProofAddress {
  id: string;
  address: string;
  protocol: Protocol;
  status: AddressStatus;
  type: string | null;
  externalId: string | null;
  derivationIndex: number | null;
  masterPublicKey: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProofBinding {
  id: string;
  deposit_reference: string;
  address: string;
  protocol: Protocol;
  status: 'active' | 'unbound';
  deposit_count: number;
  total_amount: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface ProofTransfer {
  id: string;
  business_type: 'deposit' | 'order';
  business_id: string;
  deposit_reference: string;
  amount: string;
  token: string;
  chain: string;
  to_address: string;
  transaction_hash: string;
  is_confirmed: boolean;
  confirmations: number;
  detected_at: string;
}

interface ProofChain {
  chainId: string;
  name: string;
  protocol: Protocol;
  network: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  blockExplorerUrl: string;
  isTestnet: boolean;
  isEnabled: boolean;
  syncStatus: {
    latestProcessedBlock: number;
    syncStatus: string;
    isHealthy: boolean;
    behindBlocks: number;
    updatedAt: string;
  };
}

interface ProofToken {
  symbol: string;
  name: string;
  decimals: number;
  chains: Array<{ chainId: string; contractAddress: string }>;
}

interface ProofOrder {
  id: string;
  orderId: string;
  order_reference: string | null;
  orderReference: string | null;
  amount: string;
  token: string;
  currency: string;
  chain: string;
  chainId: string;
  address: string;
  status: 'pending' | 'completed' | 'expired';
  created_at: string;
  updated_at: string;
  expires_at: string;
  completed_at: string | null;
  payment_window_minutes: number;
  url: string;
  payment_url: string;
  proofMode: true;
}

interface ProofWebhookEndpoint {
  id: string;
  endpoint_name: string;
  endpoint_type: 'webhook' | 'email' | 'telegram';
  config: Record<string, unknown>;
  subscribed_events: string[];
  max_retries: number;
  timeout_ms: number;
  description: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface ProofWebhookLog {
  id: string;
  endpoint_id: string;
  event_type: string;
  business_type: 'order' | 'deposit' | 'test';
  business_id: string;
  status: 'delivered' | 'simulated';
  attempts: number;
  response_status: number;
  created_at: string;
  payload_preview: Record<string, unknown>;
}

interface ProofState {
  addresses: ProofAddress[];
  bindings: ProofBinding[];
  orders: ProofOrder[];
  transfers: ProofTransfer[];
  endpoints: ProofWebhookEndpoint[];
  logs: ProofWebhookLog[];
  sequence: number;
}

const defaultDemoEmail = 'admin@example.com';
const defaultDemoPassword = 'payin-demo-password';
const proofTokenPrefix = 'payin-proof-session:';
const proofCookieName = 'payin_cloud_session';
const proofNow = '2026-05-25T00:00:00.000Z';
const protocols: Protocol[] = ['evm', 'tron', 'solana'];
const proofChains: ProofChain[] = [
  {
    chainId: 'ethereum-sepolia',
    name: 'Ethereum Sepolia',
    protocol: 'evm',
    network: 'sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://example.invalid/proof/ethereum-sepolia',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
    isTestnet: true,
    isEnabled: true,
    syncStatus: {
      latestProcessedBlock: 0,
      syncStatus: 'proof-mode',
      isHealthy: true,
      behindBlocks: 0,
      updatedAt: proofNow,
    },
  },
];
const proofTokens: ProofToken[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chains: [{ chainId: 'ethereum-sepolia', contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' }],
  },
];

export function mountProofModeRoutes(app: Hono, provider: CloudControlPlaneProvider, env: NodeJS.ProcessEnv = process.env) {
  const state = createProofState();

  app.post('/api/v1/auth/login', async c => {
    const body = await parseJsonObject(c.req.raw);
    if (!body.ok) return c.json({ success: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' }, 400);

    const credentials = proofCredentials(env);
    const username = normalizeEmail(body.value.username ?? body.value.email);
    const password = typeof body.value.password === 'string' ? body.value.password : '';
    if (username !== credentials.email || password !== credentials.password) {
      return c.json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Invalid demo email or password.' }, 401);
    }

    await provider.ready?.();
    const login = provider.devLogin({ email: credentials.email });
    const token = `${proofTokenPrefix}${encodeURIComponent(login.session.id)}`;
    c.header('Set-Cookie', proofSessionCookie(login.session.id, login.session.expiresAt));
    return c.json({
      success: true,
      data: {
        token,
        user: adminUser(login.user, login.organization),
        session: {
          id: login.session.sessionPreview,
          expiresAt: login.session.expiresAt,
          authBoundary: 'proof-session-cookie',
          sensitiveMaterialReturned: false,
        },
      },
      proofMode: true,
      delivery: 'demo-password-no-email-sent',
    });
  });

  app.post('/api/v1/auth/logout', async c => {
    c.header('Set-Cookie', `${proofCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return c.json({ success: true, proofMode: true });
  });

  app.get('/api/v1/auth/me', proofAuth, async c => {
    await provider.ready?.();
    const credentials = proofCredentials(env);
    const login = provider.devLogin({ email: credentials.email, organizationId: c.req.header('X-Organization-Id') });
    return c.json({ success: true, data: adminUser(login.user, login.organization), proofMode: true });
  });

  app.use('/api/v1/organizations', async (c, next) => {
    if (!hasProofAuth(c)) return next();
    await provider.ready?.();
    const organizations = provider.listOrganizations().organizations.map(org => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: 'owner',
      memberStatus: 'active',
      createdAt: org.createdAt,
    }));
    const selectedOrganizationId = c.req.header('X-Organization-Id');
    const selectedOrganization = organizations.find(org => org.id === selectedOrganizationId) ?? organizations[0] ?? null;
    return c.json({ success: true, data: organizations, organizations, selectedOrganization, proofMode: true });
  });

  app.use('/api/v1/organizations/*', async (c, next) => {
    if (!hasProofAuth(c)) return next();
    await provider.ready?.();
    const parts = new URL(c.req.url).pathname.split('/');
    const organizationId = parts[4] ?? '';
    if (c.req.method === 'GET' && parts[5] === 'members') {
      return c.json({ success: true, data: provider.listMembers(organizationId).members, proofMode: true });
    }
    return next();
  });

  app.use('/api/v1/config/*', async (c, next) => {
    if (!hasProofAuth(c)) return next();
    if (c.req.method !== 'GET') return next();
    const key = new URL(c.req.url).pathname.replace('/api/v1/config/', '');
    if (key === 'cloud') return next();
    const values: Record<string, unknown> = {
      'services.deposits_enabled': true,
      'services.address_pool_enabled': true,
      'services.webhooks_enabled': true,
    };
    return c.json({ success: true, data: { key, value: values[key] ?? null, source: 'proof-mode' }, proofMode: true });
  });

  app.get('/api/v1/address-pool/summary', proofAuth, c => c.json(success(addressPoolSummary(state))));
  app.get('/api/v1/address-pool/availability', proofAuth, c => {
    const protocol = normalizeProtocol(c.req.query('protocol')) ?? 'evm';
    return c.json(success(protocolSummary(state, protocol)));
  });
  app.get('/api/v1/address-pool/addresses', proofAuth, c => {
    const protocol = normalizeProtocol(c.req.query('protocol'));
    const addresses = state.addresses.filter(address => !protocol || address.protocol === protocol);
    return c.json(success({ addresses, pagination: pagination(addresses.length, c.req.query('page'), c.req.query('pageSize')) }));
  });
  app.post('/api/v1/address-pool/addresses', proofAuth, async c => {
    const body = await parseJsonObject(c.req.raw);
    if (!body.ok || !Array.isArray(body.value.addresses)) {
      return c.json({ success: false, error: 'INVALID_ADDRESSES', message: 'addresses must be an array.' }, 400);
    }
    const imported: ProofAddress[] = [];
    for (const candidate of body.value.addresses) {
      if (!isRecord(candidate)) continue;
      const protocol = normalizeProtocol(candidate.protocol);
      if (!protocol || typeof candidate.address !== 'string' || !candidate.address.trim()) continue;
      const candidateAddress = candidate.address.trim();
      const existing = state.addresses.find(address => address.address === candidateAddress && address.protocol === protocol);
      if (existing) continue;
      const now = new Date().toISOString();
      const address: ProofAddress = {
        id: nextId(state, 'addr'),
        address: candidateAddress,
        protocol,
        status: 'available',
        type: null,
        externalId: null,
        derivationIndex: typeof candidate.derivationIndex === 'number' ? candidate.derivationIndex : null,
        masterPublicKey: typeof candidate.masterPublicKey === 'string' ? candidate.masterPublicKey : null,
        createdAt: now,
        updatedAt: now,
      };
      state.addresses.push(address);
      imported.push(address);
    }
    return c.json(success({ imported: imported.length, addresses: imported }), 201);
  });
  app.patch('/api/v1/address-pool/addresses/:address/archive', proofAuth, c => updateAddressStatus(c, state, 'archived'));
  app.patch('/api/v1/address-pool/addresses/:address/unarchive', proofAuth, c => updateAddressStatus(c, state, 'available'));

  app.post('/api/v1/deposits/bind', proofAuth, async c => {
    const body = await parseJsonObject(c.req.raw);
    if (!body.ok) return c.json({ success: false, error: 'INVALID_JSON' }, 400);
    const depositReference = typeof body.value.depositReference === 'string' ? body.value.depositReference.trim() : '';
    const protocol = normalizeProtocol(body.value.protocol);
    if (!depositReference || !protocol) return c.json({ success: false, error: 'INVALID_BIND_REQUEST' }, 400);
    const address = state.addresses.find(item => item.protocol === protocol && item.status === 'available');
    if (!address) return c.json({ success: false, error: 'ADDRESS_POOL_EMPTY', message: `No available ${protocol} proof addresses.` }, 409);
    address.status = 'bound';
    address.type = 'deposit';
    address.externalId = depositReference;
    address.updatedAt = new Date().toISOString();
    const binding: ProofBinding = {
      id: nextId(state, 'bind'),
      deposit_reference: depositReference,
      address: address.address,
      protocol,
      status: 'active',
      deposit_count: 0,
      total_amount: {},
      created_at: address.updatedAt,
      updated_at: address.updatedAt,
    };
    state.bindings.push(binding);
    return c.json(success(binding, { message: 'Proof deposit address bound.' }), 201);
  });
  app.post('/api/v1/deposits/unbind', proofAuth, async c => {
    const body = await parseJsonObject(c.req.raw);
    if (!body.ok) return c.json({ success: false, error: 'INVALID_JSON' }, 400);
    const addressValue = typeof body.value.address === 'string' ? body.value.address : '';
    const binding = state.bindings.find(item => item.address === addressValue && item.status === 'active');
    if (!binding) return c.json({ success: false, error: 'BINDING_NOT_FOUND' }, 404);
    binding.status = 'unbound';
    const address = state.addresses.find(item => item.address === addressValue && item.protocol === binding.protocol);
    if (address) {
      address.status = 'available';
      address.type = null;
      address.externalId = null;
      address.updatedAt = new Date().toISOString();
    }
    return c.json(success(binding));
  });
  app.get('/api/v1/deposits/references', proofAuth, c => c.json(success(depositReferences(state), { pagination: pagination(depositReferences(state).length, c.req.query('page'), c.req.query('limit')) })));
  app.get('/api/v1/deposits', proofAuth, c => {
    const reference = c.req.query('depositReference');
    const data = state.bindings.filter(binding => !reference || binding.deposit_reference === reference);
    return c.json(success(data, { pagination: pagination(data.length, c.req.query('page'), c.req.query('limit')) }));
  });
  app.get('/api/v1/deposits/stats', proofAuth, c => c.json(success(depositStats(state))));
  app.get('/api/v1/transfers', proofAuth, c => {
    const businessType = c.req.query('businessType');
    const orderId = c.req.query('orderId');
    const data = state.transfers.filter(transfer => {
      if (businessType && transfer.business_type !== businessType) return false;
      if (orderId && transfer.business_id !== orderId && transfer.deposit_reference !== orderId) return false;
      return true;
    });
    return c.json(success(data, { pagination: pagination(data.length, c.req.query('page'), c.req.query('limit')) }));
  });

  app.get('/api/v1/chains', proofAuth, c => c.json(success(proofChains, { total: proofChains.length })));
  app.get('/api/v1/tokens', proofAuth, c => c.json({ success: true, tokens: proofTokens, total: proofTokens.length, proofMode: true }));
  app.post('/api/v1/orders', proofAuth, async c => createProofOrderRoute(c, state));
  app.get('/api/v1/orders', proofAuth, c => {
    const data = filterOrders(state.orders, c.req.query('status'), c.req.query('createdAfter'));
    return c.json(success(data, { pagination: pagination(data.length, c.req.query('page'), c.req.query('limit')) }));
  });
  app.get('/api/v1/orders/stats', proofAuth, c => c.json(success(orderStats(filterOrders(state.orders, undefined, c.req.query('createdAfter'))))));
  app.get('/api/v1/orders/:id', proofAuth, c => {
    const order = state.orders.find(item => item.id === c.req.param('id'));
    if (!order) return c.json({ success: false, error: 'ORDER_NOT_FOUND', message: 'Proof order not found.' }, 404);
    return c.json(success(order));
  });

  app.get('/api/v1/notifications/endpoints', proofAuth, c => c.json(success(state.endpoints)));
  app.post('/api/v1/notifications/endpoints', proofAuth, async c => {
    const body = await parseJsonObject(c.req.raw);
    if (!body.ok) return c.json({ success: false, error: 'INVALID_JSON' }, 400);
    const now = new Date().toISOString();
    const endpoint: ProofWebhookEndpoint = {
      id: nextId(state, 'wh'),
      endpoint_name: stringValue(body.value.endpoint_name, 'R11 Proof Webhook'),
      endpoint_type: endpointType(body.value.endpoint_type),
      config: safeWebhookConfig(body.value.config),
      subscribed_events: Array.isArray(body.value.subscribed_events) ? body.value.subscribed_events.map(String) : ['order.created', 'deposit.confirmed'],
      max_retries: numberValue(body.value.max_retries, 0),
      timeout_ms: numberValue(body.value.timeout_ms, 1000),
      description: typeof body.value.description === 'string' ? body.value.description : null,
      is_enabled: body.value.is_enabled !== false,
      created_at: now,
      updated_at: now,
    };
    state.endpoints.push(endpoint);
    return c.json(success(endpoint), 201);
  });
  app.post('/api/v1/notifications/endpoints/:id/test', proofAuth, c => {
    const endpoint = ensureEndpoint(state, c.req.param('id') ?? '');
    const log = appendWebhookLog(state, endpoint.id, 'test.ping', 'test', endpoint.id);
    return c.json(success({ endpoint, delivery: 'simulated-no-network-call', log }));
  });
  app.get('/api/v1/notifications/logs', proofAuth, c => c.json(success(state.logs)));
  app.get('/api/v1/notifications/statistics', proofAuth, c => c.json(success({ total: state.logs.length, delivered: state.logs.length, failed: 0, proofMode: true })));
  app.get('/api/v1/notifications/queue/status', proofAuth, c => c.json(success({ queued: 0, processing: 0, failed: 0, proofMode: true })));

  app.post('/api/v1/cloud-layer/proof/external-webhook/order', proofAuth, c => c.json(success(triggerProofWebhook(state, 'order'))));
  app.post('/api/v1/cloud-layer/proof/external-webhook/deposit', proofAuth, c => c.json(success(triggerProofWebhook(state, 'deposit'))));

  app.get('/pay/order/:id', c => {
    const order = state.orders.find(item => item.id === c.req.param('id'));
    if (!order) return c.text('Proof order not found', 404);
    return c.html(`<!doctype html><title>PayIn Proof Order</title><main><h1>PayIn Proof Order</h1><p>${escapeHtml(order.amount)} ${escapeHtml(order.token)} on ${escapeHtml(order.chain)}</p><p><code>${escapeHtml(order.address)}</code></p></main>`);
  });
}

function proofAuth(c: Context, next: Next) {
  if (!hasProofAuth(c)) {
    return c.json({ success: false, error: 'PROOF_AUTH_REQUIRED', message: 'Proof mode Admin session is required.' }, 403);
  }
  return next();
}

function hasProofAuth(c: Context) {
  const authorization = c.req.header('Authorization') ?? '';
  if (authorization.startsWith(`Bearer ${proofTokenPrefix}`)) return true;
  return parseCookie(c.req.header('Cookie'))[proofCookieName]?.length > 0;
}

function proofCredentials(env: NodeJS.ProcessEnv): ProofCredentials {
  return {
    email: normalizeEmail(env.PAYIN_CLOUD_DEMO_EMAIL) ?? defaultDemoEmail,
    password: env.PAYIN_CLOUD_DEMO_PASSWORD ?? defaultDemoPassword,
  };
}

function adminUser(user: { id: string; email: string; displayName: string }, organization: { id: string; name: string; slug: string }) {
  return {
    id: user.id,
    username: user.displayName,
    email: user.email,
    role: 'railway-proof',
    isSuperadmin: true,
    currentOrganization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: 'owner',
      memberStatus: 'active',
    },
  };
}

function createProofState(): ProofState {
  const addresses: ProofAddress[] = [
    seedAddress('evm', '0x1111111111111111111111111111111111111111', 0),
    seedAddress('evm', '0x2222222222222222222222222222222222222222', 1),
    seedAddress('tron', 'TProof111111111111111111111111111111111', 0),
    seedAddress('tron', 'TProof222222222222222222222222222222222', 1),
    seedAddress('solana', 'ProofSo111111111111111111111111111111111111111', 0),
  ];
  return { addresses, bindings: [], orders: [], transfers: [], endpoints: [defaultEndpoint()], logs: [], sequence: 1 };
}

function seedAddress(protocol: Protocol, address: string, derivationIndex: number): ProofAddress {
  return {
    id: `seed_${protocol}_${derivationIndex}`,
    address,
    protocol,
    status: 'available',
    type: null,
    externalId: null,
    derivationIndex,
    masterPublicKey: null,
    createdAt: proofNow,
    updatedAt: proofNow,
  };
}

function defaultEndpoint(): ProofWebhookEndpoint {
  return {
    id: 'wh_r11_default',
    endpoint_name: 'R11 Proof Webhook',
    endpoint_type: 'webhook',
    config: { url: 'https://example.invalid/payin-proof-webhook' },
    subscribed_events: ['order.created', 'deposit.confirmed'],
    max_retries: 0,
    timeout_ms: 1000,
    description: 'Deterministic proof endpoint; no network delivery is attempted.',
    is_enabled: true,
    created_at: proofNow,
    updated_at: proofNow,
  };
}

function updateAddressStatus(c: Context, state: ProofState, status: AddressStatus) {
  const addressValue = decodeURIComponent(c.req.param('address') ?? '');
  const address = state.addresses.find(item => item.address === addressValue);
  if (!address) return c.json({ success: false, error: 'ADDRESS_NOT_FOUND' }, 404);
  address.status = status;
  address.updatedAt = new Date().toISOString();
  return c.json(success(address));
}

function addressPoolSummary(state: ProofState) {
  const summaries = protocols.map(protocol => protocolSummary(state, protocol));
  return {
    protocols: summaries,
    totalAddresses: summaries.reduce((sum, item) => sum + item.total, 0),
    totalAvailable: summaries.reduce((sum, item) => sum + item.available, 0),
    hasAddresses: summaries.some(item => item.total > 0),
    hasAvailableAddresses: summaries.some(item => item.available > 0),
  };
}

function protocolSummary(state: ProofState, protocol: Protocol) {
  const addresses = state.addresses.filter(address => address.protocol === protocol && address.status !== 'archived');
  return {
    protocol,
    total: addresses.length,
    available: addresses.filter(address => address.status === 'available').length,
    allocated: addresses.filter(address => address.status === 'allocated').length,
    bound: addresses.filter(address => address.status === 'bound').length,
    coolingDown: 0,
  };
}

async function createProofOrderRoute(c: Context, state: ProofState) {
  const body = await parseJsonObject(c.req.raw);
  if (!body.ok) return c.json({ success: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' }, 400);

  const amount = stringValue(body.value.amount, '').trim();
  const currency = stringValue(body.value.currency, '').trim().toUpperCase();
  const chainId = stringValue(body.value.chainId, '').trim();
  const orderReference = optionalString(body.value.orderReference);
  const paymentWindow = positiveInteger(body.value.paymentWindow, 10);

  if (!amount || !currency || !chainId) {
    return c.json({ success: false, error: 'ORDER_VALIDATION_FAILED', message: 'amount, currency, and chainId are required.' }, 400);
  }
  if (!/^\d+(\.\d{1,18})?$/.test(amount)) {
    return c.json({ success: false, error: 'ORDER_AMOUNT_FORMAT_INVALID', message: 'Amount must be a numeric string.' }, 400);
  }
  if (!isSupportedProofTokenChain(currency, chainId)) {
    return c.json({ success: false, error: 'UNSUPPORTED_TOKEN_CHAIN', message: `${currency} is not supported on ${chainId} in proof mode.` }, 400);
  }

  const address = state.addresses.find(item => item.protocol === chainProtocol(chainId) && item.status === 'available');
  if (!address) return c.json({ success: false, error: 'ADDRESS_POOL_EMPTY', message: 'No available EVM proof addresses.' }, 409);

  const now = new Date().toISOString();
  const id = nextId(state, 'order');
  const url = `/pay/order/${id}`;
  address.status = 'allocated';
  address.type = 'order';
  address.externalId = id;
  address.updatedAt = now;

  const order: ProofOrder = {
    id,
    orderId: id,
    order_reference: orderReference,
    orderReference,
    amount,
    token: currency,
    currency,
    chain: chainId,
    chainId,
    address: address.address,
    status: 'pending',
    created_at: now,
    updated_at: now,
    expires_at: new Date(Date.now() + paymentWindow * 60_000).toISOString(),
    completed_at: null,
    payment_window_minutes: paymentWindow,
    url,
    payment_url: url,
    proofMode: true,
  };
  state.orders.push(order);
  return c.json(success(order, { message: 'Proof order created successfully.' }), 201);
}

function isSupportedProofTokenChain(currency: string, chainId: string) {
  return proofTokens.some(token => token.symbol === currency && token.chains.some(chain => chain.chainId === chainId));
}

function chainProtocol(chainId: string): Protocol {
  return proofChains.find(chain => chain.chainId === chainId)?.protocol ?? 'evm';
}

function filterOrders(orders: ProofOrder[], status?: string, createdAfter?: string) {
  const createdAfterDate = createdAfter ? new Date(createdAfter) : null;
  return orders.filter(order => {
    if (status && status !== 'all' && order.status !== status) return false;
    if (createdAfterDate && !Number.isNaN(createdAfterDate.getTime()) && new Date(order.created_at) < createdAfterDate) return false;
    return true;
  });
}

function orderStats(orders: ProofOrder[]) {
  const completedOrders = orders.filter(order => order.status === 'completed');
  const byStatus = orders.reduce<Record<string, number>>((counts, order) => {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
    return counts;
  }, {});
  const byChain = orders.reduce<Record<string, number>>((counts, order) => {
    counts[order.chain] = (counts[order.chain] ?? 0) + 1;
    return counts;
  }, {});
  const byToken = orders.reduce<Record<string, number>>((counts, order) => {
    counts[order.token] = (counts[order.token] ?? 0) + 1;
    return counts;
  }, {});
  return {
    totalOrders: orders.length,
    completedOrders: completedOrders.length,
    pendingOrders: orders.filter(order => order.status === 'pending').length,
    expiredOrders: orders.filter(order => order.status === 'expired').length,
    totalAmount: sumOrderAmounts(orders),
    completedAmount: sumOrderAmounts(completedOrders),
    avgPaymentTimeSeconds: 0,
    byStatus,
    byChain,
    byToken,
    proofMode: true,
  };
}

function sumOrderAmounts(orders: ProofOrder[]) {
  return orders.reduce((sum, order) => sum + Number(order.amount), 0).toFixed(2);
}

function depositReferences(state: ProofState) {
  const references = new Map<string, ProofBinding[]>();
  for (const binding of state.bindings.filter(item => item.status === 'active')) {
    references.set(binding.deposit_reference, [...(references.get(binding.deposit_reference) ?? []), binding]);
  }
  return [...references.entries()].map(([depositReference, bindings]) => {
    const transfers = state.transfers.filter(transfer => transfer.deposit_reference === depositReference);
    const totalAmount: Record<string, string> = {};
    for (const transfer of transfers) {
      totalAmount[transfer.token] = String(Number(totalAmount[transfer.token] ?? 0) + Number(transfer.amount));
    }
    return {
      depositReference,
      protocols: [...new Set(bindings.map(binding => binding.protocol))],
      addressCount: bindings.length,
      totalDeposits: transfers.length,
      totalAmount,
      lastDepositAt: transfers.at(-1)?.detected_at ?? null,
    };
  });
}

function depositStats(state: ProofState) {
  return {
    totalReferences: new Set(state.bindings.map(binding => binding.deposit_reference)).size,
    totalBoundAddresses: state.bindings.filter(binding => binding.status === 'active').length,
    totalDeposits: state.transfers.filter(transfer => transfer.business_type === 'deposit').length,
    totalAmount: state.transfers.reduce<Record<string, number>>((amounts, transfer) => {
      amounts[transfer.token] = (amounts[transfer.token] ?? 0) + Number(transfer.amount);
      return amounts;
    }, {}),
  };
}

function triggerProofWebhook(state: ProofState, businessType: 'order' | 'deposit') {
  const endpoint = state.endpoints.find(item => item.is_enabled) ?? defaultEndpoint();
  const transfer = businessType === 'deposit' ? appendDepositTransfer(state) : appendOrderTransfer(state);
  const log = appendWebhookLog(state, endpoint.id, businessType === 'deposit' ? 'deposit.confirmed' : 'order.created', businessType, transfer.id);
  return { delivery: 'simulated-no-network-call', businessType, transfer, log };
}

function appendDepositTransfer(state: ProofState): ProofTransfer {
  const binding = state.bindings.find(item => item.status === 'active') ?? autoBind(state);
  binding.deposit_count += 1;
  binding.total_amount.USDC = String(Number(binding.total_amount.USDC ?? 0) + 12.34);
  const transfer = transferRecord(state, 'deposit', binding.deposit_reference, binding.address, binding.protocol, '12.34');
  state.transfers.push(transfer);
  return transfer;
}

function appendOrderTransfer(state: ProofState): ProofTransfer {
  const order = state.orders.find(item => item.status === 'pending') ?? createWebhookProofOrder(state);
  order.status = 'completed';
  order.completed_at = new Date().toISOString();
  order.updated_at = order.completed_at;
  const transfer = transferRecord(state, 'order', order.id, order.address, chainProtocol(order.chain), order.amount);
  state.transfers.push(transfer);
  return transfer;
}

function createWebhookProofOrder(state: ProofState): ProofOrder {
  const address = state.addresses.find(item => item.protocol === 'evm' && item.status === 'available') ?? state.addresses[0];
  const now = new Date().toISOString();
  const id = nextId(state, 'order');
  address.status = 'allocated';
  address.type = 'order';
  address.externalId = id;
  address.updatedAt = now;
  const order: ProofOrder = {
    id,
    orderId: id,
    order_reference: 'r12-proof-webhook-order',
    orderReference: 'r12-proof-webhook-order',
    amount: '3.21',
    token: 'USDC',
    currency: 'USDC',
    chain: 'ethereum-sepolia',
    chainId: 'ethereum-sepolia',
    address: address.address,
    status: 'pending',
    created_at: now,
    updated_at: now,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    completed_at: null,
    payment_window_minutes: 10,
    url: `/pay/order/${id}`,
    payment_url: `/pay/order/${id}`,
    proofMode: true,
  };
  state.orders.push(order);
  return order;
}

function autoBind(state: ProofState): ProofBinding {
  const address = state.addresses.find(item => item.protocol === 'evm' && item.status === 'available') ?? state.addresses[0];
  address.status = 'bound';
  address.type = 'deposit';
  address.externalId = 'r11-proof-reference';
  const binding: ProofBinding = {
    id: nextId(state, 'bind'),
    deposit_reference: 'r11-proof-reference',
    address: address.address,
    protocol: address.protocol,
    status: 'active',
    deposit_count: 0,
    total_amount: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  state.bindings.push(binding);
  return binding;
}

function transferRecord(state: ProofState, businessType: 'deposit' | 'order', reference: string, address: string, protocol: Protocol, amount: string): ProofTransfer {
  const id = nextId(state, businessType);
  return {
    id,
    business_type: businessType,
    business_id: reference,
    deposit_reference: reference,
    amount,
    token: 'USDC',
    chain: protocol === 'tron' ? 'tron' : protocol === 'solana' ? 'solana' : 'ethereum-sepolia',
    to_address: address,
    transaction_hash: `0x${id.replace(/[^a-zA-Z0-9]/g, '').padEnd(64, '0').slice(0, 64)}`,
    is_confirmed: true,
    confirmations: 12,
    detected_at: new Date().toISOString(),
  };
}

function appendWebhookLog(state: ProofState, endpointId: string, eventType: string, businessType: ProofWebhookLog['business_type'], businessId: string): ProofWebhookLog {
  const log: ProofWebhookLog = {
    id: nextId(state, 'log'),
    endpoint_id: endpointId,
    event_type: eventType,
    business_type: businessType,
    business_id: businessId,
    status: 'simulated',
    attempts: 1,
    response_status: 202,
    created_at: new Date().toISOString(),
    payload_preview: { eventType, businessType, businessId, proofMode: true },
  };
  state.logs.push(log);
  return log;
}

function ensureEndpoint(state: ProofState, id: string) {
  const endpoint = state.endpoints.find(item => item.id === id);
  if (endpoint) return endpoint;
  const fallback = defaultEndpoint();
  state.endpoints.push(fallback);
  return fallback;
}

function success(data: unknown, extra?: Record<string, unknown>) {
  return { success: true, data, proofMode: true, ...(extra ?? {}) };
}

async function parseJsonObject(request: Request): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false }> {
  try {
    const value = await request.json();
    return isRecord(value) ? { ok: true, value } : { ok: false };
  } catch {
    return { ok: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeProtocol(value: unknown): Protocol | null {
  return protocols.includes(value as Protocol) ? (value as Protocol) : null;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : fallback;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function endpointType(value: unknown): ProofWebhookEndpoint['endpoint_type'] {
  return value === 'email' || value === 'telegram' ? value : 'webhook';
}

function safeWebhookConfig(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return { url: 'https://example.invalid/payin-proof-webhook' };
  const config = { ...value };
  for (const key of Object.keys(config)) {
    if (/secret|token|password|key/i.test(key)) config[key] = '[redacted-proof-value]';
  }
  return config;
}

function pagination(total: number, pageValue?: string, limitValue?: string) {
  const page = Math.max(1, Number(pageValue ?? 1) || 1);
  const limit = Math.max(1, Number(limitValue ?? 100) || 100);
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

function nextId(state: ProofState, prefix: string) {
  const id = `${prefix}_r12_${String(state.sequence).padStart(4, '0')}`;
  state.sequence += 1;
  return id;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function proofSessionCookie(sessionId: string, expiresAt: string) {
  return [
    `${proofCookieName}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ].join('; ');
}

function parseCookie(value: string | undefined) {
  const cookies: Record<string, string> = {};
  for (const part of value?.split(';') ?? []) {
    const [name, ...rest] = part.trim().split('=');
    if (!name) continue;
    cookies[name] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}
