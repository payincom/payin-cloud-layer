#!/usr/bin/env node
import { createCloudApiApp } from '../dist/adapters/open-app.js';

const app = createCloudApiApp();
const base = 'http://r11.local';
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
  const data = await response.json();
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

const me = await request('GET', '/api/v1/auth/me');
assert(me.data.data.email === (process.env.PAYIN_CLOUD_DEMO_EMAIL ?? 'admin@example.com'), 'auth/me did not return demo user');

const importPool = await request('POST', '/api/v1/address-pool/addresses', {
  addresses: [
    { protocol: 'evm', address: '0x3333333333333333333333333333333333333333', derivationIndex: 2, masterPublicKey: null },
    { protocol: 'tron', address: 'TProof333333333333333333333333333333333', derivationIndex: 2, masterPublicKey: null },
  ],
}, 201);
assert(importPool.data.data.imported === 2, 'address import count mismatch');
const poolSummary = await request('GET', '/api/v1/address-pool/summary');
assert(poolSummary.data.data.hasAddresses === true && poolSummary.data.data.totalAvailable >= 2, 'address pool summary unavailable');
console.log(JSON.stringify({ step: 'address-pool', ok: true, imported: importPool.data.data.imported, totalAvailable: poolSummary.data.data.totalAvailable }, null, 2));

const bind = await request('POST', '/api/v1/deposits/bind', { depositReference: 'r11-demo-user-001', protocol: 'evm' }, 201);
assert(bind.data.data.deposit_reference === 'r11-demo-user-001', 'deposit bind reference mismatch');
const references = await request('GET', '/api/v1/deposits/references');
assert(references.data.data.some(ref => ref.depositReference === 'r11-demo-user-001'), 'deposit reference not listed');
const bound = await request('GET', '/api/v1/deposits');
assert(bound.data.data.some(item => item.deposit_reference === 'r11-demo-user-001'), 'bound deposit address not listed');
const stats = await request('GET', '/api/v1/deposits/stats');
assert(stats.data.data.totalBoundAddresses >= 1, 'deposit stats missing bound address');
console.log(JSON.stringify({ step: 'deposit-config', ok: true, reference: bind.data.data.deposit_reference, totalBoundAddresses: stats.data.data.totalBoundAddresses }, null, 2));

const endpoint = await request('POST', '/api/v1/notifications/endpoints', {
  endpoint_name: 'R11 Smoke Proof Endpoint',
  endpoint_type: 'webhook',
  config: { url: 'https://example.invalid/r11-smoke', signingSecret: 'must-redact' },
  subscribed_events: ['order.created', 'deposit.confirmed'],
}, 201);
assert(endpoint.data.data.config.signingSecret === '[redacted-proof-value]', 'webhook config was not redacted');
const endpointTest = await request('POST', `/api/v1/notifications/endpoints/${endpoint.data.data.id}/test`);
assert(endpointTest.data.data.delivery === 'simulated-no-network-call', 'webhook endpoint test was not simulated');
const orderProof = await request('POST', '/api/v1/cloud-layer/proof/external-webhook/order');
const depositProof = await request('POST', '/api/v1/cloud-layer/proof/external-webhook/deposit');
assert(orderProof.data.data.businessType === 'order', 'order proof did not run');
assert(depositProof.data.data.businessType === 'deposit', 'deposit proof did not run');
const logs = await request('GET', '/api/v1/notifications/logs');
assert(logs.data.data.length >= 3, 'webhook logs missing proof deliveries');
console.log(JSON.stringify({ step: 'external-webhook-proof', ok: true, delivery: 'simulated-no-network-call', logs: logs.data.data.length }, null, 2));

console.log('r11-smoke: passed login, address-pool, deposit, and external webhook proof flows with redacted session evidence');

process.exit(0);
