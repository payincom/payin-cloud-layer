#!/usr/bin/env node

const base = (process.env.BASE_URL ?? process.env.PAYIN_CLOUD_HOSTED_URL ?? 'https://cloud-runtime-production-13e5.up.railway.app').replace(/\/$/, '');
let token = '';
let cookie = '';
let organizationId = '';

const runId = process.env.E2E_RUN_ID ?? `hosted-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(16).slice(2, 8)}`;
const orderReference = `business-e2e-order-${runId}`;
const depositReference = `business-e2e-deposit-${runId}`;
const uniqueHex = [...Buffer.from(runId)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(-40).padStart(40, '0');
const evmA = `0x${uniqueHex}`;
const evmB = `0x${uniqueHex.slice(0, 39)}8`;
const tronA = `TBusiness${uniqueHex.slice(-25)}`.slice(0, 34);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function redactedTokenPreview(value) {
  if (!value) return '[none]';
  return `${value.slice(0, 10)}…[redacted]`;
}

function redactData(value) {
  return JSON.parse(JSON.stringify(value, (key, val) => {
    if (/authorization|cookie|set-cookie|token|password|secret|key/i.test(key)) return '[redacted]';
    if (typeof val === 'string' && val.startsWith('payin-proof-session:')) return redactedTokenPreview(val);
    return val;
  }));
}

async function request(method, path, body, expected = 200) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (organizationId) headers['X-Organization-ID'] = organizationId;

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (response.status !== expected) {
    throw new Error(`${method} ${path} expected ${expected}, got ${response.status}: ${JSON.stringify(redactData(data))}`);
  }
  return { data };
}

async function main() {
  console.log(JSON.stringify({ step: 'hosted-target', ok: true, base, runId }, null, 2));

  const demoEmail = process.env.PAYIN_CLOUD_DEMO_EMAIL ?? 'admin@example.com';
  const demoPassword = process.env.PAYIN_CLOUD_DEMO_PASSWORD ?? 'payin-demo-password';

  const login = await request('POST', '/api/v1/auth/login', { username: demoEmail, password: demoPassword });
  assert(login.data.success === true, 'login failed');
  token = login.data.data.token;
  organizationId = login.data.data.user.currentOrganization.id;
  assert(token.startsWith('payin-proof-session:'), 'login did not return proof session token');
  assert(cookie, 'login did not set proof cookie');
  console.log(JSON.stringify({ step: 'login', ok: true, token: redactedTokenPreview(token), cookie: '[redacted]', organizationId }, null, 2));

  const me = await request('GET', '/api/v1/auth/me');
  assert(me.data.data.email === demoEmail, 'auth/me did not return demo user');
  const organizations = await request('GET', '/api/v1/organizations');
  assert(organizations.data.selectedOrganization?.id === organizationId, 'selected organization mismatch');
  console.log(JSON.stringify({ step: 'session-organization', ok: true, organizationId }, null, 2));

  const chains = await request('GET', '/api/v1/chains');
  assert(chains.data.data.some(chain => chain.chainId === 'ethereum-sepolia' && chain.protocol === 'evm'), 'ethereum-sepolia chain missing');
  const tokens = await request('GET', '/api/v1/tokens');
  const usdc = tokens.data.tokens.find(item => item.symbol === 'USDC');
  assert(usdc?.chains?.some(chain => chain.chainId === 'ethereum-sepolia'), 'USDC ethereum-sepolia support missing');

  const importPool = await request('POST', '/api/v1/address-pool/addresses', {
    addresses: [
      { protocol: 'evm', address: evmA, derivationIndex: 710001, masterPublicKey: null },
      { protocol: 'evm', address: evmB, derivationIndex: 710002, masterPublicKey: null },
      { protocol: 'tron', address: tronA, derivationIndex: 710003, masterPublicKey: null },
    ],
  }, 201);
  assert(importPool.data.data.imported >= 2, 'address import did not add enough fresh hosted addresses');
  const poolSummary = await request('GET', '/api/v1/address-pool/summary');
  assert(poolSummary.data.data.hasAddresses === true && poolSummary.data.data.totalAvailable >= 2, 'address pool summary unavailable');
  console.log(JSON.stringify({ step: 'address-pool', ok: true, imported: importPool.data.data.imported, totalAvailable: poolSummary.data.data.totalAvailable }, null, 2));

  const pendingBefore = await request('GET', '/api/v1/orders?status=pending');
  const preExistingPendingCount = Array.isArray(pendingBefore.data.data) ? pendingBefore.data.data.length : 0;

  const createOrder = await request('POST', '/api/v1/orders', {
    orderReference,
    amount: '42.50',
    currency: 'USDC',
    chainId: 'ethereum-sepolia',
    paymentWindow: 15,
  }, 201);
  const order = createOrder.data.data;
  assert(order.id && order.orderId === order.id, 'created order id shape mismatch');
  assert(order.order_reference === orderReference, 'created order reference mismatch');
  assert(order.status === 'pending', 'created order should start pending');
  assert(order.token === 'USDC' && order.chain === 'ethereum-sepolia', 'created order token/chain mismatch');
  assert(order.address?.startsWith('0x'), 'created order did not allocate an evm address');
  assert(order.url === `/pay/order/${order.id}`, 'created order payment url mismatch');

  const orderList = await request('GET', '/api/v1/orders?status=pending');
  assert(orderList.data.data.some(item => item.id === order.id), 'created order not listed as pending');
  const orderDetail = await request('GET', `/api/v1/orders/${order.id}`);
  assert(orderDetail.data.data.id === order.id && orderDetail.data.data.status === 'pending', 'order detail mismatch');
  const orderStatsBeforeProof = await request('GET', '/api/v1/orders/stats');
  assert(orderStatsBeforeProof.data.data.byStatus.pending >= 1, 'order stats missing pending order');
  const paymentPage = await request('GET', `/pay/order/${order.id}`);
  assert(String(paymentPage.data).includes('PayIn Proof Order'), 'payment URL did not render proof order page');
  console.log(JSON.stringify({ step: 'order-create-list-detail-stats-page', ok: true, orderId: order.id, status: order.status }, null, 2));

  const existingBindings = await request('GET', '/api/v1/deposits');
  for (const binding of existingBindings.data.data ?? []) {
    if (binding.status === 'active' && binding.deposit_reference !== depositReference && binding.address) {
      await request('POST', '/api/v1/deposits/unbind', { address: binding.address });
    }
  }

  const bind = await request('POST', '/api/v1/deposits/bind', { depositReference, protocol: 'evm' }, 201);
  assert(bind.data.data.deposit_reference === depositReference, 'deposit bind reference mismatch');
  assert(bind.data.data.address?.startsWith('0x') && bind.data.data.address !== order.address, 'deposit bind did not allocate a distinct evm address');
  const referencesBeforeProof = await request('GET', '/api/v1/deposits/references');
  assert(referencesBeforeProof.data.data.some(ref => ref.depositReference === depositReference), 'deposit reference not listed');
  const boundDeposits = await request('GET', `/api/v1/deposits?depositReference=${encodeURIComponent(depositReference)}`);
  assert(boundDeposits.data.data.some(item => item.deposit_reference === depositReference && item.status === 'active'), 'bound deposit address not listed');
  const depositStatsBeforeProof = await request('GET', '/api/v1/deposits/stats');
  assert(depositStatsBeforeProof.data.data.totalBoundAddresses >= 1, 'deposit stats missing bound address');
  console.log(JSON.stringify({ step: 'deposit-bind-references-list-stats', ok: true, reference: depositReference, totalBoundAddresses: depositStatsBeforeProof.data.data.totalBoundAddresses }, null, 2));

  const endpoint = await request('POST', '/api/v1/notifications/endpoints', {
    endpoint_name: `Business E2E Hosted ${runId}`,
    endpoint_type: 'webhook',
    config: { url: 'https://example.invalid/business-e2e-hosted', signingSecret: 'must-redact' },
    subscribed_events: ['order.created', 'deposit.confirmed'],
  }, 201);
  assert(endpoint.data.data.config.signingSecret === '[redacted-proof-value]', 'webhook config was not redacted');
  const endpointTest = await request('POST', `/api/v1/notifications/endpoints/${endpoint.data.data.id}/test`);
  assert(endpointTest.data.data.delivery === 'simulated-no-network-call', 'webhook endpoint test was not simulated');

  let orderProof;
  for (let attempt = 0; attempt < preExistingPendingCount + 3; attempt += 1) {
    orderProof = await request('POST', '/api/v1/cloud-layer/proof/external-webhook/order');
    assert(orderProof.data.data.businessType === 'order', 'order proof did not run');
    if (orderProof.data.data.transfer.business_id === order.id) break;
  }
  assert(orderProof?.data.data.transfer.business_id === order.id, 'order proof transfer not linked to created order');
  const completedOrder = await request('GET', `/api/v1/orders/${order.id}`);
  assert(completedOrder.data.data.status === 'completed', 'order proof did not complete created order');
  const orderTransfers = await request('GET', `/api/v1/transfers?orderId=${encodeURIComponent(order.id)}`);
  assert(orderTransfers.data.data.some(transfer => transfer.business_type === 'order' && transfer.business_id === order.id), 'order transfer not linked by orderId');

  const depositProof = await request('POST', '/api/v1/cloud-layer/proof/external-webhook/deposit');
  assert(depositProof.data.data.businessType === 'deposit', 'deposit proof did not run');
  assert(depositProof.data.data.transfer.deposit_reference === depositReference, 'deposit proof transfer not linked to bound reference');
  const depositTransfers = await request('GET', '/api/v1/transfers?businessType=deposit');
  assert(depositTransfers.data.data.some(transfer => transfer.deposit_reference === depositReference), 'deposit transfer not listed');
  const referencesAfterProof = await request('GET', '/api/v1/deposits/references');
  assert(referencesAfterProof.data.data.some(ref => ref.depositReference === depositReference && ref.totalDeposits >= 1), 'deposit reference did not include proof transfer');
  const depositStatsAfterProof = await request('GET', '/api/v1/deposits/stats');
  assert(depositStatsAfterProof.data.data.totalDeposits >= 1, 'deposit stats missing proof transfer');

  const logs = await request('GET', '/api/v1/notifications/logs');
  assert(logs.data.data.length >= 3, 'webhook logs missing proof deliveries');
  console.log(JSON.stringify({ step: 'linked-transfer-webhook-proof', ok: true, delivery: 'simulated-no-network-call', logs: logs.data.data.length }, null, 2));

  console.log('hosted-business-e2e: passed Railway hosted redacted login, address seeding, order create/list/detail/stats/page/proof, deposit bind/references/list/stats/proof, and linked transfer checks');
}

main().catch(error => {
  console.error(JSON.stringify({ step: 'hosted-business-e2e', ok: false, error: error.message }, null, 2));
  process.exit(1);
});
