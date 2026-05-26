#!/usr/bin/env node
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCloudApiApp } from '../dist/adapters/open-app.js';
import { createLocalOpenSeamPolicies, localOpenSeamPolicyStatus } from '../dist/local-open-seam-policies.js';
import {
  createLocalControlPlaneStorageFromEnv,
  LocalJsonFileControlPlaneStorage,
} from '../dist/local-control-plane-storage.js';
import { createPostgresControlPlaneStorageFromEnv } from '../dist/postgres-control-plane-storage.js';

const cloudOnlyPath = '/api/v1/organizations';
const validTenant = 'tenant-local';
const diagnosticToken = 'local-diagnostic-token';
const diagnosticAuth = `PayIn-Diagnostic ${diagnosticToken}`;
const durableControlPlanePath = join(tmpdir(), `payin-cloud-layer-control-plane-${process.pid}.json`);

function policyConfig(overrides = {}) {
  return {
    mode: 'enforce',
    tenantHeader: 'X-Organization-Id',
    authHeader: 'Authorization',
    entitlementHeader: 'X-PayIn-Cloud-Entitlement',
    allowedTenants: [validTenant],
    allowedEntitlements: [],
    allowBearerAuth: false,
    diagnosticAuthTokens: [diagnosticToken],
    apiKeys: ['local-api-key'],
    entitlementsByTenant: {
      [validTenant]: ['Organizations API', 'API Keys', 'Cloud Control Plane'],
    },
    auditEnabled: false,
    ...overrides,
  };
}

function createSmokeApp(overrides = {}) {
  return createCloudApiApp({
    policyConfig: policyConfig(overrides),
    runtimeConfig: {
      healthMode: 'layer',
      runtimeName: 'smoke',
    },
  });
}

function createRuntimeContext(tenantId = validTenant) {
  return {
    runtimeKind: 'multi-tenant',
    paymentScope: { id: tenantId, kind: 'tenant', label: `Smoke ${tenantId}` },
    actor: { type: 'system', id: 'runtime-smoke' },
    source: 'runtime-smoke',
  };
}

function passMiddleware() {
  return async (_c, next) => next();
}

function createOrderRouteDependencies(runtimeContext = createRuntimeContext(), managerOverrides = {}) {
  return {
    getManager: () => ({
      createOrderForRuntimeScope: async () => ({ orderId: 'order_smoke_001', orderReference: 'smoke-order' }),
      ...managerOverrides,
    }),
    getAuth: () => ({}),
    createAuthMiddleware: () => passMiddleware(),
    createAuditMiddleware: () => passMiddleware(),
    requirePermission: () => passMiddleware(),
    resolveRuntimeContext: () => runtimeContext,
    getBaseUrl: () => 'https://pay.example.test',
    buildOrderPaymentUrl: (baseUrl, orderId) => `${baseUrl}/pay/${orderId}`,
  };
}

function createOrderPolicySmokeApp(overrides = {}, orderDependencies = createOrderRouteDependencies()) {
  return createCloudApiApp({
    policyConfig: policyConfig(overrides),
    runtimeConfig: {
      healthMode: 'layer',
      runtimeName: 'smoke',
    },
    openApp: {
      routeDependencies: {
        orders: orderDependencies,
      },
    },
  });
}

const createOrderBody = {
  orderReference: 'smoke-order',
  amount: '10.00',
  currency: 'USDC',
  chainId: '1',
};

async function expectResponse(app, path, expectedStatus, check, init) {
  const response = await app.request(path, init);
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(`${path} expected ${expectedStatus}, got ${response.status}: ${body}`);
  }
  if (check) await check(response);
  return response;
}

function expectPolicyHeaders(response, expected) {
  for (const [name, value] of Object.entries(expected)) {
    const actual = response.headers.get(name);
    if (actual !== value) throw new Error(`${name} expected ${value}, got ${actual}`);
  }
}

function assertNoSensitiveResponseShape(value, label) {
  const sensitiveKey = /secret|token|credential|private|password/i;
  const visit = item => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(item)) {
      if (sensitiveKey.test(key)) throw new Error(`${label} exposed sensitive-shaped response field: ${key}`);
      visit(child);
    }
  };
  visit(value);
  const serialized = JSON.stringify(value).toLowerCase();
  for (const marker of ['local-diagnostic-token', 'payin_local_test', 'password', 'private-key']) {
    if (serialized.includes(marker)) throw new Error(`${label} leaked sensitive-shaped response material: ${marker}`);
  }
}

const enforceApp = createSmokeApp();
const adminSpaPaths = [
  '/admin',
  '/admin/login',
  '/admin/auth/callback',
  '/admin/orders',
  '/admin/payment-links',
  '/admin/deposits',
  '/admin/address-pool',
  '/admin/config',
  '/admin/api-keys',
  '/admin/cloud-layer/control-plane',
];

const parityMatrixGate = [
  { id: 'admin.login', status: 'covered', evidence: ['adminSpaPaths', '/api/v1/auth/magic-link', '/api/v1/auth/oauth/config'] },
  { id: 'admin.auth-callback', status: 'covered', evidence: ['adminSpaPaths'] },
  { id: 'admin.dashboard', status: 'covered', evidence: ['adminSpaPaths'] },
  { id: 'admin.orders', status: 'covered', evidence: ['adminSpaPaths', 'orderCreatePolicy'] },
  { id: 'admin.payment-links', status: 'covered', evidence: ['adminSpaPaths', 'paymentLinkPolicy'] },
  { id: 'admin.deposits', status: 'covered', evidence: ['adminSpaPaths'] },
  { id: 'admin.address-pool', status: 'covered', evidence: ['adminSpaPaths'] },
  { id: 'admin.config-webhooks', status: 'covered', evidence: ['adminSpaPaths', 'notificationPolicy'] },
  { id: 'admin.config-system', status: 'partial', evidence: ['/api/v1/admin/diagnostics', '/api/v1/config/cloud'] },
  { id: 'admin.api-keys', status: 'covered', evidence: ['adminSpaPaths', '/api/v1/api-keys'] },
  { id: 'admin.cloud-layer-control-plane', status: 'covered', evidence: ['adminSpaPaths', "control-plane-status"] },
  { id: 'api.health-status-admin-static', status: 'covered', evidence: ['/health', '/cloud-layer/status', '/cloud-layer/admin/status'] },
  { id: 'api.auth-magic-link-oauth-config', status: 'covered', evidence: ['/api/v1/auth/magic-link', '/api/v1/auth/oauth/config'] },
  { id: 'api.oauth-real-providers', status: 'human-gated', evidence: ['provider routes policy-denied when unconfigured'] },
  { id: 'api.orgs-members', status: 'covered', evidence: ['/api/v1/organizations', '/api/v1/organizations/:id/members'] },
  { id: 'api.api-keys', status: 'covered', evidence: ['/api/v1/api-keys'] },
  { id: 'api.control-plane-status-bootstrap-login-entitlements', status: 'covered', evidence: ["control-plane-bootstrap", "control-plane-dev-login", "control-plane-simulated-email-login", "control-plane-entitlements-status"] },
  { id: 'api.diagnostics-redaction', status: 'covered', evidence: ['/api/v1/config/cloud', '/api/v1/admin/diagnostics'] },
  { id: 'api.orders-open-seam', status: 'covered', evidence: ['/api/v1/orders', 'orderCreatePolicy allow/deny/report-only/off'] },
  { id: 'api.payment-links-open-seam', status: 'partial', evidence: ['paymentLinkPolicy metadata'] },
  { id: 'api.notifications-open-seam', status: 'partial', evidence: ['notificationPolicy metadata'] },
  { id: 'api.deposits-open-core', status: 'out-of-scope-open-core', evidence: ['PayIn Open seam ownership'] },
  { id: 'api.address-pool-open-core', status: 'out-of-scope-open-core', evidence: ['PayIn Open seam ownership'] },
  { id: 'api.chains-tokens-open-core', status: 'out-of-scope-open-core', evidence: ['PayIn Open seam ownership'] },
  { id: 'api.transfers-open-core', status: 'out-of-scope-open-core', evidence: ['PayIn Open seam ownership'] },
  { id: 'control-plane.local-storage', status: 'covered', evidence: ['LocalJsonFileControlPlaneStorage'] },
  { id: 'control-plane.postgres-hosted-storage', status: 'human-gated', evidence: ['postgres storage requires explicit DATABASE_URL and migrates via pg'] },
  { id: 'billing.entitlements-local', status: 'covered', evidence: ['local Open seam policies', "control-plane-entitlements-status"] },
  { id: 'billing.real-provider', status: 'human-gated', evidence: ['external billing provider not local deterministic'] },
  { id: 'team.member-listing', status: 'covered', evidence: ['/api/v1/organizations/:id/members'] },
  { id: 'team.invites-ownership-transfer', status: 'human-gated', evidence: ['product/security UX gate'] },
  { id: 'ops.mcp-wallet-tools-demo', status: 'human-gated', evidence: ['R1 inventory defer'] },
];

function parityMatrixCounts() {
  return parityMatrixGate.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
}

function assertParityMatrixGate() {
  const ids = new Set();
  for (const item of parityMatrixGate) {
    if (ids.has(item.id)) throw new Error(`duplicate parity matrix gate id: ${item.id}`);
    ids.add(item.id);
    if (!['covered', 'partial', 'human-gated', 'out-of-scope-open-core'].includes(item.status)) {
      throw new Error(`unexpected parity matrix gate status for ${item.id}: ${item.status}`);
    }
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
      throw new Error(`parity matrix gate item lacks evidence: ${item.id}`);
    }
  }
  const counts = parityMatrixCounts();
  if (counts.covered < 18 || counts.partial < 1 || counts['human-gated'] < 1 || counts['out-of-scope-open-core'] < 1) {
    throw new Error(`parity matrix gate counts are unexpectedly thin: ${JSON.stringify(counts)}`);
  }
}

assertParityMatrixGate();

await expectResponse(enforceApp, '/health', 200, async response => {
  const body = await response.json();
  if (body.status !== 'healthy' || body.manager?.initialized !== true) {
    throw new Error('/health did not report healthy layer runtime');
  }
});

await expectResponse(enforceApp, '/cloud-layer/status', 200, async response => {
  const body = await response.json();
  if (
    body.runtime?.healthMode !== 'layer' ||
    body.policy?.mode !== 'enforce' ||
    body.policy?.allowedTenants !== 1 ||
    body.policy?.entitlementTenantMappings !== 1 ||
    body.openSeams?.provider !== 'cloud-layer-local-open-seam-policies' ||
    body.openSeams?.deterministic !== true ||
    body.openSeams?.seams?.orderCreatePolicy?.requiredEntitlement !== 'order:create' ||
    body.openSeams?.plans?.['local-pro']?.includes('notification:create_endpoint') !== true
  ) {
    throw new Error('/cloud-layer/status missing runtime, local policy provider, or Open seam status');
  }
});

await expectResponse(enforceApp, '/api/v1/cloud-layer/status', 200, async response => {
  const body = await response.json();
  if (
    body.layer !== 'payin-cloud-layer' ||
    body.coreForked !== false ||
    body.openSeams?.mode !== 'enforce' ||
    body.openSeams?.seams?.paymentLinkPolicy?.requiredEntitlement !== 'payment-link:create'
  ) {
    throw new Error('/api/v1/cloud-layer/status missing Cloud Layer identity or Open seam status metadata');
  }
});

const seamStatus = localOpenSeamPolicyStatus(policyConfig());
if (
  seamStatus.provider !== 'cloud-layer-local-open-seam-policies' ||
  seamStatus.seams.notificationPolicy.requiredEntitlement !== 'notification:create_endpoint' ||
  !seamStatus.plans['local-enterprise'].includes('notification:retry_notification')
) {
  throw new Error('local Open seam policy status metadata did not expose deterministic plan mapping');
}

const reportOnlyPolicies = createLocalOpenSeamPolicies(policyConfig({ mode: 'report-only', entitlementsByTenant: {}, allowedEntitlements: [] }));
const reportOnlyDecision = await reportOnlyPolicies.orderCreatePolicy.check({
  runtimeContext: createRuntimeContext(),
  request: createOrderBody,
});
if (
  reportOnlyDecision.allowed !== true ||
  reportOnlyDecision.code !== 'CLOUD_SEAM_POLICY_REPORT_ONLY' ||
  !reportOnlyDecision.message?.includes('would deny order:create') ||
  reportOnlyDecision.metadata?.enforceDecision !== 'deny' ||
  reportOnlyDecision.metadata?.source !== 'missing'
) {
  throw new Error('report-only local Open seam policy did not allow with deterministic metadata/message');
}

const explicitPolicyApp = createOrderPolicySmokeApp(
  { entitlementsByTenant: {}, allowedEntitlements: [] },
  {
    ...createOrderRouteDependencies(),
    orderCreatePolicy: {
      check: () => ({ allowed: true, message: 'explicit caller policy allow' }),
    },
  }
);
await expectResponse(
  explicitPolicyApp,
  '/api/v1/orders',
  201,
  async response => {
    const body = await response.json();
    if (body.success !== true || body.data?.url !== 'https://pay.example.test/pay/order_smoke_001') {
      throw new Error('caller-supplied explicit orderCreatePolicy was overridden by Cloud seam policy');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createOrderBody),
  }
);

const orderDenyApp = createOrderPolicySmokeApp({ entitlementsByTenant: {}, allowedEntitlements: [] });
await expectResponse(
  orderDenyApp,
  '/api/v1/orders',
  403,
  async response => {
    const body = await response.json();
    if (
      body.code !== 'CLOUD_SEAM_POLICY_DENIED' ||
      !body.message?.includes('order:create') ||
      !body.message?.includes('entitlement_required')
    ) {
      throw new Error('enforce local Open seam policy did not deny order creation with 403 decision');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createOrderBody),
  }
);

const orderAllowApp = createOrderPolicySmokeApp({ entitlementsByTenant: { [validTenant]: ['plan:local-free'] } });
await expectResponse(
  orderAllowApp,
  '/api/v1/orders',
  201,
  async response => {
    const body = await response.json();
    if (body.success !== true || body.data?.orderId !== 'order_smoke_001') {
      throw new Error('enforce local Open seam policy did not allow entitled order creation');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createOrderBody),
  }
);

const controlPlaneBase = '/api/v1/cloud-layer/control-plane';

await expectResponse(enforceApp, `${controlPlaneBase}/status`, 200, async response => {
  const body = await response.json();
  if (
    body.provider !== 'cloud-layer-local-control-plane' ||
    body.mode !== 'local-dev' ||
    body.productionSecurity !== false ||
    body.storage !== 'in-memory' ||
    body.contracts?.contractVersion !== '2026-05-m7' ||
    body.contracts?.productionReady !== false ||
    body.contracts?.secretPolicy?.storesSecretMaterial !== false ||
    body.contracts?.secretPolicy?.returnsProductionSecrets !== false ||
    body.contracts?.secretPolicy?.localTestTokensOnly !== true ||
    body.contracts?.dataClasses?.join(',') !== 'organizations,users,sessions,api-key-metadata,entitlements' ||
    body.namespace !== controlPlaneBase
  ) {
    throw new Error('local control-plane status did not expose deterministic local-dev boundary');
  }
});

const selectedDefaultStorage = createLocalControlPlaneStorageFromEnv({});
if (selectedDefaultStorage.kind !== 'in-memory') {
  throw new Error('default control-plane storage selection was not explicit in-memory local mode');
}

const selectedLocalJsonStorage = createLocalControlPlaneStorageFromEnv({
  PAYIN_CLOUD_LOCAL_CONTROL_PLANE_DURABLE: 'true',
  PAYIN_CLOUD_LOCAL_CONTROL_PLANE_FILE: durableControlPlanePath,
});
if (selectedLocalJsonStorage.kind !== 'local-json-file') {
  throw new Error('local JSON control-plane storage selection was not gated by explicit env flags');
}

try {
  createLocalControlPlaneStorageFromEnv({
    PAYIN_CLOUD_LOCAL_CONTROL_PLANE_DURABLE: 'true',
    PAYIN_CLOUD_LOCAL_CONTROL_PLANE_FILE: join(tmpdir(), `payin-cloud-layer-credential-${process.pid}.json`),
  });
  throw new Error('local JSON control-plane storage accepted a protected credential-like path');
} catch (error) {
  if (!String(error).includes('refuses .env, credential, secret, or key file paths')) throw error;
}

try {
  createPostgresControlPlaneStorageFromEnv({ PAYIN_CLOUD_CONTROL_PLANE_STORAGE: 'postgres' });
  throw new Error('Postgres control-plane storage did not require DATABASE_URL for explicit selection');
} catch (error) {
  if (!String(error).includes('requires DATABASE_URL')) throw error;
}

await expectResponse(
  enforceApp,
  `${controlPlaneBase}/bootstrap`,
  201,
  async response => {
    const body = await response.json();
    if (
      body.localDevOnly !== true ||
      body.organization?.id !== validTenant ||
      body.user?.email !== 'smoke@example.com' ||
      body.session?.sensitiveMaterialReturned !== false ||
      !Array.isArray(body.entitlements) ||
      !body.entitlements.some(entitlement => entitlement.feature === 'Cloud Control Plane' && entitlement.granted === true)
    ) {
      throw new Error('local control-plane bootstrap did not create deterministic local org/user/session/entitlements');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationName: 'Smoke Org', email: 'Smoke@Example.COM' }),
  }
);

await expectResponse(
  enforceApp,
  `${controlPlaneBase}/dev-login`,
  200,
  async response => {
    const body = await response.json();
    if (
      body.authenticated !== true ||
      body.localDevOnly !== true ||
      body.productionSecurity !== false ||
      body.user?.email !== 'smoke@example.com' ||
      body.organization?.id !== validTenant ||
      body.session?.sessionPreview?.endsWith('_preview_only') !== true
    ) {
      throw new Error('local control-plane dev-login did not return deterministic non-production session summary');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoke@example.com', organizationId: validTenant }),
  }
);


await expectResponse(
  enforceApp,
  `${controlPlaneBase}/simulated-email-login`,
  200,
  async response => {
    const cookie = response.headers.get('set-cookie') ?? '';
    const body = await response.json();
    if (
      body.authenticated !== true ||
      body.localDevOnly !== false ||
      body.simulatedEmailOnly !== true ||
      body.delivery !== 'simulated-no-email-sent' ||
      body.authBoundary !== 'server-session-cookie' ||
      !cookie.includes('payin_cloud_session=') ||
      !cookie.includes('HttpOnly') ||
      body.session?.sensitiveMaterialReturned !== false
    ) {
      throw new Error('simulated email login did not create deterministic server-session proof boundary');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'proof@example.com', organizationId: validTenant }),
  }
);

await expectResponse(
  enforceApp,
  `${controlPlaneBase}/org/current`,
  200,
  async response => {
    const body = await response.json();
    if (
      body.localDevOnly !== true ||
      body.tenant?.organizationId !== validTenant ||
      body.tenant?.source !== 'header' ||
      !body.users.some(user => user.email === 'smoke@example.com')
    ) {
      throw new Error('local control-plane current org did not resolve local tenant from header');
    }
  },
  { headers: { 'X-Organization-Id': validTenant } }
);

await expectResponse(
  enforceApp,
  `${controlPlaneBase}/api-keys`,
  201,
  async response => {
    const body = await response.json();
    if (
      body.localDevOnly !== true ||
      body.productionSecurity !== false ||
      body.sensitiveMaterialReturned !== false ||
      body.apiKey?.label !== 'Smoke Key' ||
      body.apiKey?.preview !== 'payin_local_0001_preview_only' ||
      body.apiKey?.checksum !== 'sha256-local-tenant-local-1' ||
      !body.message?.includes('no credential material')
    ) {
      throw new Error('local control-plane API key creation did not return safe metadata-only response');
    }
    assertNoSensitiveResponseShape(body, 'local control-plane API key creation');
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Organization-Id': validTenant },
    body: JSON.stringify({ label: 'Smoke Key' }),
  }
);

await expectResponse(
  enforceApp,
  `${controlPlaneBase}/api-keys`,
  200,
  async response => {
    const body = await response.json();
    if (body.organizationId !== validTenant || body.apiKeys.length !== 1 || body.apiKeys[0].preview.includes('secret')) {
      throw new Error('local control-plane API key listing did not return safe preview metadata');
    }
  },
  { headers: { 'X-Organization-Id': validTenant } }
);

await expectResponse(
  enforceApp,
  `${controlPlaneBase}/entitlements/status`,
  200,
  async response => {
    const body = await response.json();
    const apiKeysEntitlement = body.entitlements?.find(entitlement => entitlement.feature === 'API Keys');
    if (
      body.localDevOnly !== true ||
      body.evaluation !== 'deterministic-local-allowlist' ||
      apiKeysEntitlement?.quota?.used !== 1 ||
      apiKeysEntitlement?.quota?.remaining !== 4
    ) {
      throw new Error('local control-plane entitlement status did not reflect deterministic quota evaluation');
    }
  },
  { headers: { 'X-Organization-Id': validTenant } }
);

rmSync(durableControlPlanePath, { force: true });

function createDurableControlPlaneApp() {
  return createCloudApiApp({
    policyConfig: policyConfig(),
    runtimeConfig: {
      healthMode: 'layer',
      runtimeName: 'smoke-durable-local',
    },
    localControlPlaneStorage: new LocalJsonFileControlPlaneStorage({
      path: durableControlPlanePath,
      enabled: true,
    }),
  });
}

const durableAppOne = createDurableControlPlaneApp();
await expectResponse(durableAppOne, `${controlPlaneBase}/status`, 200, async response => {
  const body = await response.json();
  if (body.storage !== 'local-json-file' || body.productionSecurity !== false) {
    throw new Error('durable local control-plane status did not expose explicit dev-only JSON storage');
  }
});

await expectResponse(
  durableAppOne,
  `${controlPlaneBase}/bootstrap`,
  201,
  async response => {
    const body = await response.json();
    if (body.user?.email !== 'durable@example.com' || body.organization?.id !== validTenant) {
      throw new Error('durable local control-plane bootstrap did not create expected user/org');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationName: 'Durable Smoke Org', email: 'Durable@Example.COM' }),
  }
);

await expectResponse(
  durableAppOne,
  `${controlPlaneBase}/api-keys`,
  201,
  async response => {
    const body = await response.json();
    if (
      body.apiKey?.preview !== 'payin_local_0001_preview_only' ||
      body.sensitiveMaterialReturned !== false
    ) {
      throw new Error('durable local control-plane API key creation returned unsafe metadata');
    }
    assertNoSensitiveResponseShape(body, 'durable local control-plane API key creation');
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Organization-Id': validTenant },
    body: JSON.stringify({ label: 'Durable Smoke Key' }),
  }
);

const durableAppTwo = createDurableControlPlaneApp();
await expectResponse(
  durableAppTwo,
  `${controlPlaneBase}/org/current`,
  200,
  async response => {
    const body = await response.json();
    if (!body.users.some(user => user.email === 'durable@example.com')) {
      throw new Error('durable local control-plane did not persist users across provider instances');
    }
  },
  { headers: { 'X-Organization-Id': validTenant } }
);

await expectResponse(
  durableAppTwo,
  `${controlPlaneBase}/api-keys`,
  200,
  async response => {
    const body = await response.json();
    if (body.apiKeys.length !== 1 || body.apiKeys[0].label !== 'Durable Smoke Key') {
      throw new Error('durable local control-plane did not persist API key metadata across provider instances');
    }
  },
  { headers: { 'X-Organization-Id': validTenant } }
);

await expectResponse(
  durableAppTwo,
  `${controlPlaneBase}/dev-login`,
  200,
  async response => {
    const body = await response.json();
    if (body.user?.email !== 'durable@example.com' || body.session?.sensitiveMaterialReturned !== false) {
      throw new Error('durable local control-plane dev-login did not reuse persisted user/session safely');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'durable@example.com', organizationId: validTenant }),
  }
);

await expectResponse(
  durableAppTwo,
  `${controlPlaneBase}/entitlements/status`,
  200,
  async response => {
    const body = await response.json();
    const apiKeysEntitlement = body.entitlements?.find(entitlement => entitlement.feature === 'API Keys');
    if (apiKeysEntitlement?.quota?.used !== 1 || apiKeysEntitlement?.quota?.remaining !== 4) {
      throw new Error('durable local control-plane did not persist entitlement quota behavior');
    }
  },
  { headers: { 'X-Organization-Id': validTenant } }
);

const durableFile = readFileSync(durableControlPlanePath, 'utf8');
if (/secretMaterialReturned|sensitiveMaterialReturned|apiKeySecret|tokenPreview|sessionPreview|credential|oneTimeLocalTestToken|payin_local_test/i.test(durableFile)) {
  throw new Error('durable local control-plane file persisted secret-shaped response fields');
}
const durableSnapshot = JSON.parse(durableFile);
if (
  durableSnapshot.schemaVersion !== 1 ||
  durableSnapshot.organizations?.length !== 1 ||
  durableSnapshot.users?.length !== 2 ||
  durableSnapshot.sessions?.length !== 2 ||
  durableSnapshot.apiKeys?.length !== 1 ||
  durableSnapshot.entitlements?.length !== 4 ||
  durableSnapshot.apiKeys?.[0]?.checksum !== 'sha256-local-tenant-local-1' ||
  durableSnapshot.entitlements?.find(entitlement => entitlement.feature === 'API Keys')?.quotaUsed !== 1
) {
  throw new Error('durable local control-plane file did not persist the hardened provider/storage contract shape');
}
rmSync(durableControlPlanePath, { force: true });


let adminAssetPath;
for (const adminPath of adminSpaPaths) {
  await expectResponse(enforceApp, adminPath, 200, async response => {
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    if (!contentType.includes('text/html') || !body.includes('<div id="root"></div>')) {
      throw new Error(`${adminPath} did not serve Cloud admin HTML`);
    }
    if (!body.includes('<title>PayIn Admin</title>')) {
      throw new Error(`${adminPath} did not serve the Cloud admin SPA shell`);
    }
    const assetMatch = body.match(/(?:src|href)="(\/admin\/assets\/[^"]+)"/);
    if (!assetMatch) {
      throw new Error(`${adminPath} HTML did not reference admin-scoped assets`);
    }
    adminAssetPath ??= assetMatch[1];
  });
}

await expectResponse(enforceApp, adminAssetPath, 200, async response => {
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  if (contentType.includes('text/html') || body.includes('<div id="root"></div>') || body.length === 0) {
    throw new Error(`${adminAssetPath} did not serve a built admin asset`);
  }
});

await expectResponse(enforceApp, '/cloud-layer/admin/status', 200, async response => {
  const body = await response.json();
  const names = body.admin?.publicViteConfig?.names || [];
  if (
    body.admin?.dist?.indexHtmlExists !== true ||
    body.admin?.dist?.assetsDirExists !== true ||
    !names.includes('VITE_API_URL') ||
    !names.includes('VITE_PAYMENT_LINK_PUBLIC_URL')
  ) {
    throw new Error('/cloud-layer/admin/status missing admin dist or public VITE config names');
  }
  if (JSON.stringify(body).includes('local-diagnostic-token')) {
    throw new Error('/cloud-layer/admin/status leaked a secret-like smoke token');
  }
});

await expectResponse(enforceApp, '/api/v1/cloud-layer/admin/status', 200, async response => {
  const body = await response.json();
  const names = body.admin?.publicViteConfig?.names || [];
  if (body.admin?.dist?.indexHtmlExists !== true || names.some(name => !name.startsWith('VITE_'))) {
    throw new Error('/api/v1/cloud-layer/admin/status missing safe admin status JSON');
  }
});

await expectResponse(
  enforceApp,
  '/api/v1/auth/magic-link',
  202,
  async response => {
    const body = await response.json();
    if (
      body.success !== true ||
      body.authenticated !== false ||
      body.delivery !== 'disabled' ||
      body.mode !== 'compatibility-stub' ||
      body.email !== 'admin@example.com' ||
      body.redirectTo !== '/admin' ||
      body.nextAction?.public !== true
    ) {
      throw new Error('magic-link compatibility success body was not deterministic and non-authenticating');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ' Admin@Example.COM ', redirectTo: '/admin' }),
  }
);

await expectResponse(
  enforceApp,
  '/api/v1/auth/magic-link',
  400,
  async response => {
    const body = await response.json();
    if (body.code !== 'INVALID_EMAIL' || body.authenticated !== false) {
      throw new Error('magic-link invalid email did not return safe validation error');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  }
);

await expectResponse(
  enforceApp,
  '/api/v1/auth/magic-link',
  400,
  async response => {
    const body = await response.json();
    if (body.code !== 'INVALID_JSON' || body.authenticated !== false || body.success !== false) {
      throw new Error('magic-link invalid JSON did not return safe non-authenticating validation error');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-json',
  }
);

await expectResponse(
  enforceApp,
  '/api/v1/auth/magic-link',
  400,
  async response => {
    const body = await response.json();
    if (body.code !== 'INVALID_REDIRECT_TO' || body.authenticated !== false || body.success !== false) {
      throw new Error('magic-link invalid redirectTo did not return safe validation error');
    }
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', redirectTo: 'javascript:alert(1)' }),
  }
);

const previousAuthCompatMode = process.env.PAYIN_CLOUD_AUTH_COMPAT_MODE;
process.env.PAYIN_CLOUD_AUTH_COMPAT_MODE = 'local-dev';
try {
  await expectResponse(
    enforceApp,
    '/api/v1/auth/magic-link',
    202,
    async response => {
      const body = await response.json();
      if (
        body.mode !== 'local-dev' ||
        body.authenticated !== false ||
        body.delivery !== 'disabled' ||
        body.email !== 'local@example.com' ||
        body.redirectTo !== 'https://admin.example.test/auth/callback' ||
        body.nextAction?.type !== 'local-dev-login' ||
        body.nextAction?.public !== true
      ) {
        throw new Error('magic-link local-dev compatibility mode did not expose deterministic public stub body');
      }
    },
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Local@Example.COM', redirectTo: 'https://admin.example.test/auth/callback' }),
    }
  );
} finally {
  if (previousAuthCompatMode === undefined) delete process.env.PAYIN_CLOUD_AUTH_COMPAT_MODE;
  else process.env.PAYIN_CLOUD_AUTH_COMPAT_MODE = previousAuthCompatMode;
}

await expectResponse(enforceApp, '/api/v1/auth/oauth/config', 200, async response => {
  expectPolicyHeaders(response, {
    'X-PayIn-Cloud-Policy-Mode': 'enforce',
    'X-PayIn-Cloud-Policy-Decision': 'allow',
    'X-PayIn-Cloud-Policy-Reason': 'public_compatibility_route',
    'X-PayIn-Cloud-Tenant-Source': 'missing',
    'X-PayIn-Cloud-Auth-Scheme': 'missing',
    'X-PayIn-Cloud-Entitlement-Source': 'missing',
  });
  const body = await response.json();
  if (body.success !== true || !body.data || !Object.hasOwn(body.data, 'google') || !Object.hasOwn(body.data, 'github')) {
    throw new Error('OAuth config compatibility route was not reachable through Cloud policy');
  }
  const serializedConfig = JSON.stringify(body.data).toLowerCase();
  if (serializedConfig.includes('secret') || serializedConfig.includes('token') || serializedConfig.includes('password')) {
    throw new Error('OAuth config compatibility route exposed secret-shaped material');
  }
  for (const provider of ['google', 'github']) {
    const config = body.data[provider];
    if (config !== null && (typeof config !== 'object' || typeof config.clientId !== 'string' || Object.keys(config).some(key => key !== 'clientId'))) {
      throw new Error(`OAuth config for ${provider} did not match public clientId-only compatibility shape`);
    }
  }
});

for (const path of ['/api/v1/auth/oauth/github?frontend_url=http%3A%2F%2Flocalhost%3A3000', '/api/v1/auth/oauth/google/callback?code=stub']) {
  await expectResponse(enforceApp, path, 403, async response => {
    expectPolicyHeaders(response, {
      'X-PayIn-Cloud-Policy-Mode': 'enforce',
      'X-PayIn-Cloud-Policy-Decision': 'deny',
      'X-PayIn-Cloud-Policy-Reason': 'tenant_required',
      'X-PayIn-Cloud-Tenant-Source': 'missing',
      'X-PayIn-Cloud-Auth-Scheme': 'missing',
      'X-PayIn-Cloud-Entitlement-Source': 'missing',
    });
    const body = await response.json();
    if (body.code !== 'CLOUD_POLICY_DENIED' || body.featureName !== 'OAuth API') {
      throw new Error('unconfigured hosted OAuth provider route was not held behind deterministic Cloud policy');
    }
  });
}

await expectResponse(
  enforceApp,
  cloudOnlyPath,
  403,
  async response => {
    expectPolicyHeaders(response, {
      'X-PayIn-Cloud-Policy-Mode': 'enforce',
      'X-PayIn-Cloud-Policy-Decision': 'deny',
      'X-PayIn-Cloud-Policy-Reason': 'tenant_required',
      'X-PayIn-Cloud-Tenant-Source': 'missing',
      'X-PayIn-Cloud-Auth-Scheme': 'diagnostic',
      'X-PayIn-Cloud-Entitlement-Source': 'missing',
    });
    const body = await response.json();
    if (body.code !== 'CLOUD_POLICY_DENIED') throw new Error('unexpected missing-tenant denial body');
  },
  { headers: { Authorization: diagnosticAuth } }
);

await expectResponse(
  enforceApp,
  cloudOnlyPath,
  403,
  async response => {
    expectPolicyHeaders(response, {
      'X-PayIn-Cloud-Policy-Decision': 'deny',
      'X-PayIn-Cloud-Policy-Reason': 'auth_required',
      'X-PayIn-Cloud-Tenant-Source': 'header',
      'X-PayIn-Cloud-Auth-Scheme': 'missing',
      'X-PayIn-Cloud-Entitlement-Source': 'tenant-map',
    });
  },
  { headers: { 'X-Organization-Id': validTenant } }
);

const noEntitlementApp = createSmokeApp({ entitlementsByTenant: {}, allowedEntitlements: [] });
await expectResponse(
  noEntitlementApp,
  cloudOnlyPath,
  403,
  async response => {
    expectPolicyHeaders(response, {
      'X-PayIn-Cloud-Policy-Decision': 'deny',
      'X-PayIn-Cloud-Policy-Reason': 'entitlement_required',
      'X-PayIn-Cloud-Tenant-Source': 'header',
      'X-PayIn-Cloud-Auth-Scheme': 'diagnostic',
      'X-PayIn-Cloud-Entitlement-Source': 'missing',
    });
  },
  { headers: { 'X-Organization-Id': validTenant, Authorization: diagnosticAuth } }
);

await expectResponse(
  enforceApp,
  cloudOnlyPath,
  200,
  async response => {
    expectPolicyHeaders(response, {
      'X-PayIn-Cloud-Policy-Mode': 'enforce',
      'X-PayIn-Cloud-Policy-Decision': 'allow',
      'X-PayIn-Cloud-Policy-Reason': 'allowed',
      'X-PayIn-Cloud-Tenant-Source': 'header',
      'X-PayIn-Cloud-Auth-Scheme': 'diagnostic',
      'X-PayIn-Cloud-Entitlement-Source': 'tenant-map',
    });
    const body = await response.json();
    if (body.localDevOnly !== true || !body.organizations.some(org => org.id === validTenant)) {
      throw new Error('valid policy allow did not reach Cloud Layer organization shell');
    }
  },
  { headers: { 'X-Organization-Id': validTenant, Authorization: diagnosticAuth } }
);

await expectResponse(
  enforceApp,
  '/api/v1/organizations/tenant-local/members',
  200,
  async response => {
    const body = await response.json();
    if (body.organizationId !== validTenant || !body.members.some(member => member.role === 'owner')) {
      throw new Error('organization members shell did not return local scoped members');
    }
  },
  { headers: { 'X-Organization-Id': validTenant, Authorization: diagnosticAuth } }
);

await expectResponse(
  enforceApp,
  '/api/v1/api-keys',
  201,
  async response => {
    const body = await response.json();
    if (
      body.sensitiveMaterialReturned !== false ||
      body.apiKey?.preview?.includes('secret')
    ) {
      throw new Error('API-key shell did not return safe metadata-only response');
    }
    assertNoSensitiveResponseShape(body, 'API-key shell create');
  },
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Organization-Id': validTenant, Authorization: diagnosticAuth },
    body: JSON.stringify({ label: 'Shell Smoke Key' }),
  }
);

await expectResponse(
  enforceApp,
  '/api/v1/api-keys/cpak_local_0002',
  200,
  async response => {
    const body = await response.json();
    if (body.deleted !== true || body.apiKey?.status !== 'revoked') {
      throw new Error('API-key shell delete did not revoke local metadata');
    }
  },
  { method: 'DELETE', headers: { 'X-Organization-Id': validTenant, Authorization: diagnosticAuth } }
);

await expectResponse(
  enforceApp,
  '/api/v1/config/cloud',
  200,
  async response => {
    const body = await response.json();
    assertNoSensitiveResponseShape(body, 'Cloud config diagnostics');
    if (body.redaction !== 'names-and-counts-only' || JSON.stringify(body).includes(diagnosticToken)) {
      throw new Error('Cloud config diagnostics shell leaked values or missed redaction marker');
    }
  },
  { headers: { 'X-Organization-Id': validTenant, Authorization: diagnosticAuth } }
);

await expectResponse(
  enforceApp,
  '/api/v1/admin/diagnostics',
  403,
  async response => {
    const body = await response.json();
    if (body.code !== 'CLOUD_POLICY_DENIED' && body.code !== 'DIAGNOSTIC_AUTH_REQUIRED') {
      throw new Error('unauthorized admin diagnostics did not fail safely');
    }
    assertNoSensitiveResponseShape(body, 'unauthorized admin diagnostics denial');
  },
  { headers: { 'X-Organization-Id': validTenant } }
);

await expectResponse(
  enforceApp,
  '/api/v1/admin/diagnostics',
  200,
  async response => {
    const body = await response.json();
    assertNoSensitiveResponseShape(body, 'authorized admin diagnostics');
    if (body.operator?.scheme !== 'diagnostic' || body.operator?.authorized !== true || body.productionSecurity !== false) {
      throw new Error('admin diagnostics shell did not enforce local diagnostic operator boundary');
    }
  },
  { headers: { 'X-Organization-Id': validTenant, Authorization: diagnosticAuth } }
);

const reportOnlyApp = createSmokeApp({ mode: 'report-only' });
await expectResponse(reportOnlyApp, cloudOnlyPath, 200, async response => {
  expectPolicyHeaders(response, {
    'X-PayIn-Cloud-Policy-Mode': 'report-only',
    'X-PayIn-Cloud-Policy-Decision': 'allow',
    'X-PayIn-Cloud-Policy-Reason': 'tenant_required',
    'X-PayIn-Cloud-Tenant-Source': 'missing',
    'X-PayIn-Cloud-Auth-Scheme': 'missing',
  });
});

const offApp = createSmokeApp({ mode: 'off' });
await expectResponse(offApp, cloudOnlyPath, 200, async response => {
  expectPolicyHeaders(response, {
    'X-PayIn-Cloud-Policy-Mode': 'off',
    'X-PayIn-Cloud-Policy-Decision': 'allow',
    'X-PayIn-Cloud-Policy-Reason': 'tenant_required',
  });
});

console.log(`runtime-smoke: parity matrix gate counts ${JSON.stringify(parityMatrixCounts())}`);
console.log('runtime-smoke: passed health, status, local/durable control-plane, API shell parity, admin static/status, auth compatibility, OAuth config, enforce deny/allow, report-only, off policy, and local parity matrix gate checks');
process.exit(0);
