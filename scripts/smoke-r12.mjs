#!/usr/bin/env node
import { createCloudApiApp } from '../dist/adapters/open-app.js';

const app = createCloudApiApp();
const base = 'http://r12.local';
let token = '';
let cookie = '';
let organizationId = '';

function redactHeaders(headers) {
  const redacted = {};
  for (const [key, value] of headers.entries()) {
    if (/set-cookie|authorization|cookie/i.test(key)) redacted[key] = '[redacted]';
    else redacted[key] = value;
  }
  return redacted;
}

async function request(method, path, body, expected = 200) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (organizationId) headers['X-Organization-ID'] = organizationId;
  const response = await app.fetch(new Request(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (response.status !== expected) {
    throw new Error(`${method} ${path} expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return { data, headers: redactHeaders(response.headers) };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function redactedTokenPreview(value) {
  if (!value) return '[none]';
  return `${value.slice(0, 10)}…[redacted]`;
}

const login = await request('POST', '/api/v1/auth/login', {
  username: process.env.PAYIN_CLOUD_DEMO_EMAIL ?? 'admin@example.com',
  password: process.env.PAYIN_CLOUD_DEMO_PASSWORD ?? 'payin-demo-password',
});
assert(login.data.success === true, 'login failed');
token = login.data.data.token;
organizationId = login.data.data.user.currentOrganization.id;
assert(token.startsWith('payin-proof-session:'), 'login did not return proof session token');
assert(cookie, 'login did not set proof cookie');
console.log(JSON.stringify({ step: 'login', ok: true, token: redactedTokenPreview(token), cookie: '[redacted]', organizationId }, null, 2));

const organizations = await request('GET', '/api/v1/organizations');
assert(Array.isArray(organizations.data.organizations), 'organizations response missing top-level organizations array');
assert(Array.isArray(organizations.data.data), 'organizations response missing compatibility data array');
assert(organizations.data.organizations.some(org => org.id === organizationId), 'organizations response missing selected organization');
assert(organizations.data.selectedOrganization?.id === organizationId, 'organizations response selectedOrganization mismatch');
console.log(JSON.stringify({ step: 'organizations', ok: true, organizationId }, null, 2));

const chains = await request('GET', '/api/v1/chains');
assert(chains.data.data.some(chain => chain.chainId === 'ethereum-sepolia' && chain.protocol === 'evm'), 'ethereum-sepolia chain missing');
const tokens = await request('GET', '/api/v1/tokens');
const usdc = tokens.data.tokens.find(token => token.symbol === 'USDC');
assert(usdc?.chains?.some(chain => chain.chainId === 'ethereum-sepolia'), 'USDC ethereum-sepolia support missing');
console.log(JSON.stringify({ step: 'chains-tokens', ok: true, chains: chains.data.total, tokens: tokens.data.total }, null, 2));

const importPool = await request('POST', '/api/v1/address-pool/addresses', {
  addresses: [
    { protocol: 'evm', address: '0x4444444444444444444444444444444444444444', derivationIndex: 4, masterPublicKey: null },
  ],
}, 201);
assert(importPool.data.data.imported === 1, 'address import count mismatch');
const availability = await request('GET', '/api/v1/address-pool/availability?protocol=evm');
assert(availability.data.data.available >= 1, 'evm address availability missing');

const createOrder = await request('POST', '/api/v1/orders', {
  orderReference: 'r12-smoke-order-001',
  amount: '12.50',
  currency: 'USDC',
  chainId: 'ethereum-sepolia',
  paymentWindow: 10,
}, 201);
const order = createOrder.data.data;
assert(order.id && order.orderId === order.id, 'created order id shape mismatch');
assert(order.order_reference === 'r12-smoke-order-001', 'created order reference mismatch');
assert(order.token === 'USDC' && order.chain === 'ethereum-sepolia', 'created order token/chain mismatch');
assert(order.address?.startsWith('0x'), 'created order did not allocate evm address');
assert(order.url === `/pay/order/${order.id}`, 'created order payment url mismatch');
console.log(JSON.stringify({ step: 'create-order', ok: true, orderId: order.id, chain: order.chain, token: order.token, addressAllocated: true }, null, 2));

const list = await request('GET', '/api/v1/orders');
assert(list.data.data.some(item => item.id === order.id && item.status === 'pending'), 'created order not listed');
const stats = await request('GET', '/api/v1/orders/stats');
assert(stats.data.data.totalOrders >= 1, 'order stats did not include created order');
assert(stats.data.data.byChain['ethereum-sepolia'] >= 1, 'order stats missing ethereum-sepolia');
assert(stats.data.data.byToken.USDC >= 1, 'order stats missing USDC');
const paymentPage = await request('GET', `/pay/order/${order.id}`);
assert(String(paymentPage.data).includes('PayIn Proof Order'), 'payment URL did not render proof order page');
console.log(JSON.stringify({ step: 'order-list-stats-payment-url', ok: true, totalOrders: stats.data.data.totalOrders }, null, 2));

const endpoint = await request('POST', '/api/v1/notifications/endpoints', {
  endpoint_name: 'R12 Smoke Proof Endpoint',
  endpoint_type: 'webhook',
  config: { url: 'https://example.invalid/r12-smoke', signingSecret: 'must-redact' },
  subscribed_events: ['order.created', 'deposit.confirmed'],
}, 201);
assert(endpoint.data.data.config.signingSecret === '[redacted-proof-value]', 'webhook config was not redacted');
const orderProof = await request('POST', '/api/v1/cloud-layer/proof/external-webhook/order');
const depositProof = await request('POST', '/api/v1/cloud-layer/proof/external-webhook/deposit');
assert(orderProof.data.data.businessType === 'order', 'order proof did not run');
assert(depositProof.data.data.businessType === 'deposit', 'deposit proof did not run');
const transfers = await request('GET', `/api/v1/transfers?orderId=${order.id}`);
assert(transfers.data.data.some(transfer => transfer.business_type === 'order' && transfer.business_id === order.id), 'order transfer not linked by orderId');
const logs = await request('GET', '/api/v1/notifications/logs');
assert(logs.data.data.length >= 2, 'webhook logs missing proof deliveries');
console.log(JSON.stringify({ step: 'external-webhook-proof', ok: true, delivery: 'simulated-no-network-call', logs: logs.data.data.length }, null, 2));

console.log('r12-smoke: passed proof login, chains/tokens, address import, order create/list/stats/payment-url, and external webhook flows with redacted session evidence');

process.exit(0);
