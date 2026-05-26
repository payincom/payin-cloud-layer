import type { Context, Hono, Next } from 'hono';
import type {
  CloudControlPlaneAdminDiagnostics,
  CloudControlPlaneConfigDiagnostics,
  CloudControlPlaneCreateApiKeyResult,
  CloudControlPlaneCreateApiKeyRequest,
  CloudControlPlaneCreateOrganizationResult,
  CloudControlPlaneDeleteApiKeyResult,
  CloudControlPlaneDevLoginRequest,
  CloudControlPlaneDevLoginResult,
  CloudControlPlaneEntitlement,
  CloudControlPlaneMemberRecord,
  CloudControlPlaneOrganizationsResult,
  CloudControlPlaneProvider,
  CloudControlPlaneProviderDescriptor,
  CloudControlPlaneSafeProviderDiagnostics,
  CloudControlPlaneTenantResult,
} from './cloud-control-plane-contracts.js';
import type { CloudPolicyConfig } from './cloud-policy.js';
import type { CloudRuntimeState } from './cloud-runtime.js';
import { sessionSummary } from './cloud-control-plane-contracts.js';
import {
  InMemoryLocalControlPlaneStorage,
  type LocalApiKeyRecord,
  type LocalControlPlaneSnapshot,
  type LocalControlPlaneStorage,
  type LocalEntitlementRecord,
  type LocalOrganizationRecord,
  type LocalSessionRecord,
  type LocalUserRecord,
} from './local-control-plane-storage.js';

interface BootstrapRequest {
  organizationName?: unknown;
  email?: unknown;
}

interface DevLoginRequest {
  email?: unknown;
  organizationId?: unknown;
}

interface CreateApiKeyRequest {
  label?: unknown;
}

interface CreateOrganizationRequest {
  name?: unknown;
}

const localClock = '2026-01-01T00:00:00.000Z';
const defaultOrganizationId = 'tenant-local';
const defaultUserEmail = 'dev@payin.local';
const defaultEntitlementFeatures = [
  'Organizations API',
  'Cloud Control Plane',
  'API Keys',
  'Entitlements',
] as const;

export class LocalControlPlaneProvider implements CloudControlPlaneProvider {
  readonly descriptor: CloudControlPlaneProviderDescriptor;
  private organizations = new Map<string, LocalOrganizationRecord>();
  private users = new Map<string, LocalUserRecord>();
  private sessions = new Map<string, LocalSessionRecord>();
  private apiKeys = new Map<string, LocalApiKeyRecord>();
  private entitlements = new Map<string, LocalEntitlementRecord>();
  private apiKeySequence = 1;
  private readonly storage: LocalControlPlaneStorage;
  private readonly readyPromise: Promise<void>;

  constructor(storage: LocalControlPlaneStorage = new InMemoryLocalControlPlaneStorage()) {
    this.storage = storage;
    this.descriptor = {
      id: 'cloud-layer-local-control-plane',
      kind: 'local-dev',
      status: 'active',
      storageKind: storage.kind,
      productionReady: false,
      contractVersion: '2026-05-m7',
      dataClasses: ['organizations', 'users', 'sessions', 'api-key-metadata', 'entitlements'],
      secretPolicy: {
        storesSecretMaterial: false,
        returnsProductionSecrets: false,
        localTestTokensOnly: true,
      },
      notes: [
        'Local development implementation of Cloud control-plane contracts.',
        'Routes and Admin UI depend on CloudControlPlaneProvider, not on the storage implementation.',
        'API keys are metadata only; no production credential material is generated, stored, or returned.',
        'Create responses return safe metadata only; local deterministic checks use checksums and previews.',
      ],
    };
    this.loadSnapshot(this.storage.read());
    if (this.storage.ready) {
      this.readyPromise = this.initializeFromStorage();
    } else {
      this.bootstrap({ organizationName: 'PayIn Local Dev', email: defaultUserEmail });
      this.readyPromise = Promise.resolve();
    }
  }

  async ready() {
    await this.readyPromise;
  }

  status() {
    return {
      ok: true,
      provider: 'cloud-layer-local-control-plane',
      mode: 'local-dev',
      productionSecurity: false,
      deterministic: true,
      storage: this.storage.kind,
      storageDescription: this.storage.description,
      namespace: '/api/v1/cloud-layer/control-plane',
      contracts: this.descriptor,
      counts: {
        organizations: this.organizations.size,
        users: this.users.size,
        sessions: this.sessions.size,
        apiKeys: this.apiKeys.size,
      },
    };
  }

  bootstrap(request: { organizationName?: string; email?: string } = {}) {
    const organizationName = request.organizationName?.trim() || 'PayIn Local Dev';
    const email = normalizeEmail(request.email) ?? defaultUserEmail;
    const organization = this.ensureOrganization(defaultOrganizationId, organizationName);
    const user = this.ensureUser(email, organization.id);
    const session = this.ensureSession(user.id, organization.id);

    return {
      localDevOnly: true,
      organization,
      user,
      session: sessionSummary(session),
      entitlements: this.entitlementStatus(organization.id).entitlements,
    };
  }

  devLogin(request: CloudControlPlaneDevLoginRequest = {}): CloudControlPlaneDevLoginResult {
    const organization = this.resolveOrganization(request.organizationId);
    const email = normalizeEmail(request.email) ?? defaultUserEmail;
    const user = this.ensureUser(email, organization.id);
    const session = this.ensureSession(user.id, organization.id);

    return {
      authenticated: true,
      localDevOnly: true,
      productionSecurity: false,
      authBoundary: this.storage.kind === 'postgres' ? 'server-session-cookie' : 'local-preview',
      user,
      organization,
      session: sessionSummary(session),
    };
  }

  currentTenant(organizationId?: string | null): CloudControlPlaneTenantResult {
    const organization = this.resolveOrganization(organizationId ?? undefined);
    const users = [...this.users.values()].filter(user => user.organizationIds.includes(organization.id));
    return {
      localDevOnly: true,
      tenant: {
        id: organization.id,
        organizationId: organization.id,
        source: organizationId ? 'header' : 'default-local',
      },
      organization,
      users,
    };
  }

  listOrganizations(): CloudControlPlaneOrganizationsResult {
    return {
      localDevOnly: true,
      organizations: [...this.organizations.values()],
    };
  }

  createOrganization(request: { name?: string } = {}): CloudControlPlaneCreateOrganizationResult {
    const name = normalizeOrganizationName(request.name);
    if (!name) throw new LocalControlPlaneError(400, 'INVALID_ORGANIZATION_NAME', 'Organization name must be 1-80 characters.');
    const slug = slugify(name);
    const id = `org_local_${slug}`;
    const existing = this.organizations.get(id);
    const organization = existing ?? {
      id,
      slug,
      name,
      mode: 'local-dev' as const,
      createdAt: localClock,
    };
    this.organizations.set(organization.id, organization);
    this.ensureUser(defaultUserEmail, organization.id);
    this.persist();
    return {
      localDevOnly: true,
      organization,
      members: this.membersForOrganization(organization.id),
    };
  }

  listMembers(organizationId: string) {
    const organization = this.requireOrganization(organizationId);
    return {
      localDevOnly: true,
      organizationId: organization.id,
      members: this.membersForOrganization(organization.id),
    };
  }

  listApiKeys(organizationId?: string | null) {
    const organization = this.resolveOrganization(organizationId ?? undefined);
    return {
      localDevOnly: true,
      organizationId: organization.id,
      apiKeys: [...this.apiKeys.values()].filter(apiKey => apiKey.organizationId === organization.id),
    };
  }

  createApiKey(
    request: CloudControlPlaneCreateApiKeyRequest = {},
    organizationId?: string | null
  ): CloudControlPlaneCreateApiKeyResult {
    const organization = this.resolveOrganization(organizationId ?? undefined);
    const label = normalizeLabel(request.label) ?? `Local API Key ${this.apiKeySequence}`;
    const id = `cpak_local_${String(this.apiKeySequence).padStart(4, '0')}`;
    const checksum = `sha256-local-${organization.id}-${this.apiKeySequence}`;
    const apiKey: LocalApiKeyRecord = {
      id,
      organizationId: organization.id,
      label,
      preview: `payin_local_${String(this.apiKeySequence).padStart(4, '0')}_preview_only`,
      checksum,
      status: 'active',
      createdAt: localClock,
    };
    this.apiKeySequence += 1;
    this.apiKeys.set(apiKey.id, apiKey);
    this.persist();

    return {
      localDevOnly: true,
      productionSecurity: false,
      apiKey,
      sensitiveMaterialReturned: false,
      message: 'Local dev API key metadata created; no credential material is generated, stored, or returned by this Cloud Layer surface.',
    };
  }

  deleteApiKey(keyId: string, organizationId?: string | null): CloudControlPlaneDeleteApiKeyResult {
    const organization = this.resolveOrganization(organizationId ?? undefined);
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey || apiKey.organizationId !== organization.id) {
      throw new LocalControlPlaneError(404, 'API_KEY_NOT_FOUND', 'Local API key metadata was not found for this organization.');
    }
    const revoked: LocalApiKeyRecord = { ...apiKey, status: 'revoked' };
    this.apiKeys.set(revoked.id, revoked);
    this.persist();
    return {
      localDevOnly: true,
      organizationId: organization.id,
      apiKey: revoked,
      deleted: true,
    };
  }

  cloudConfigDiagnostics(runtime: CloudRuntimeState, policy: CloudPolicyConfig): CloudControlPlaneConfigDiagnostics {
    return {
      localDevOnly: true,
      productionSecurity: false,
      mode: 'local-dev',
      runtime: {
        name: runtime.config.runtimeName,
        healthMode: runtime.config.healthMode,
      },
      policy: {
        mode: policy.mode,
        tenantHeader: policy.tenantHeader,
        authHeader: policy.authHeader,
        entitlementHeader: policy.entitlementHeader,
        allowedTenants: policy.allowedTenants.length,
        allowedEntitlements: policy.allowedEntitlements.length,
        diagnosticOperators: policy.diagnosticAuthTokens.length,
        apiKeys: policy.apiKeys.length,
        entitlementTenantMappings: Object.keys(policy.entitlementsByTenant).length,
      },
      provider: safeProviderDiagnostics(this.descriptor),
      redaction: 'names-and-counts-only',
    };
  }

  adminDiagnostics(): CloudControlPlaneAdminDiagnostics {
    return {
      localDevOnly: true,
      productionSecurity: false,
      operator: {
        scheme: 'diagnostic',
        localOnly: true,
        authorized: true,
      },
      provider: safeProviderDiagnostics(this.descriptor),
      dataClasses: this.descriptor.dataClasses,
      counts: this.status().counts,
      warnings: [
        'Local diagnostics only; not a production admin surface.',
        'No raw API key values, credentials, or environment values are returned.',
      ],
    };
  }

  entitlementStatus(organizationId?: string | null) {
    const organization = this.resolveOrganization(organizationId ?? undefined);
    const activeApiKeys = [...this.apiKeys.values()].filter(
      apiKey => apiKey.organizationId === organization.id && apiKey.status === 'active'
    ).length;
    const entitlements: CloudControlPlaneEntitlement[] = defaultEntitlementFeatures.map(feature => {
      const limit = feature === 'API Keys' ? 5 : 1_000;
      const used = feature === 'API Keys' ? activeApiKeys : 0;
      this.entitlements.set(entitlementKey(organization.id, feature), {
        organizationId: organization.id,
        feature,
        granted: true,
        quotaLimit: limit,
        quotaUsed: used,
        reset: 'never',
      });
      return {
        feature,
        granted: true,
        quota: {
          limit,
          used,
          remaining: Math.max(limit - used, 0),
          reset: 'never',
        },
      };
    });
    this.persist();

    return {
      localDevOnly: true,
      organizationId: organization.id,
      evaluation: 'deterministic-local-allowlist',
      entitlements,
    };
  }

  private async initializeFromStorage() {
    await this.storage.ready;
    this.loadSnapshot(this.storage.read());
    this.bootstrap({ organizationName: 'PayIn Railway Proof', email: defaultUserEmail });
  }

  private ensureOrganization(id: string, name: string): LocalOrganizationRecord {
    const existing = this.organizations.get(id);
    if (existing) return existing;

    const organization: LocalOrganizationRecord = {
      id,
      slug: 'local-dev',
      name,
      mode: 'local-dev',
      createdAt: localClock,
    };
    this.organizations.set(organization.id, organization);
    this.persist();
    return organization;
  }

  private ensureUser(email: string, organizationId: string): LocalUserRecord {
    const id = `user_${email.replace(/[^a-z0-9]+/g, '_')}`;
    const existing = this.users.get(id);
    if (existing) {
      if (!existing.organizationIds.includes(organizationId)) {
        existing.organizationIds.push(organizationId);
        this.persist();
      }
      return existing;
    }

    const user: LocalUserRecord = {
      id,
      email,
      displayName: email.split('@')[0] || 'local-dev',
      organizationIds: [organizationId],
      createdAt: localClock,
    };
    this.users.set(user.id, user);
    this.persist();
    return user;
  }

  private ensureSession(userId: string, organizationId: string): LocalSessionRecord {
    const id = `local_session_${userId}_${organizationId}`.replace(/[^a-zA-Z0-9_]+/g, '_');
    const existing = this.sessions.get(id);
    if (existing) return existing;

    const session: LocalSessionRecord = {
      id,
      userId,
      organizationId,
      createdAt: localClock,
      expiresAt: '2026-01-02T00:00:00.000Z',
    };
    this.sessions.set(session.id, session);
    this.persist();
    return session;
  }

  private resolveOrganization(organizationId?: string): LocalOrganizationRecord {
    if (organizationId) {
      const organization = this.organizations.get(organizationId);
      if (organization) return organization;
    }
    return this.organizations.get(defaultOrganizationId) ?? this.ensureOrganization(defaultOrganizationId, 'PayIn Local Dev');
  }

  private requireOrganization(organizationId: string): LocalOrganizationRecord {
    const organization = this.organizations.get(organizationId);
    if (!organization) throw new LocalControlPlaneError(404, 'ORGANIZATION_NOT_FOUND', 'Local organization was not found.');
    return organization;
  }

  private membersForOrganization(organizationId: string): CloudControlPlaneMemberRecord[] {
    return [...this.users.values()]
      .filter(user => user.organizationIds.includes(organizationId))
      .map(user => ({
        id: `member_${organizationId}_${user.id}`.replace(/[^a-zA-Z0-9_]+/g, '_'),
        organizationId,
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.email === defaultUserEmail ? 'owner' : 'member',
        status: 'active',
        createdAt: user.createdAt,
      }));
  }

  private loadSnapshot(snapshot: LocalControlPlaneSnapshot) {
    this.apiKeySequence = snapshot.apiKeySequence;
    this.organizations = new Map(snapshot.organizations.map(organization => [organization.id, organization]));
    this.users = new Map(snapshot.users.map(user => [user.id, user]));
    this.sessions = new Map(snapshot.sessions.map(session => [session.id, session]));
    this.apiKeys = new Map(snapshot.apiKeys.map(apiKey => [apiKey.id, apiKey]));
    this.entitlements = new Map(snapshot.entitlements.map(entitlement => [entitlementKey(entitlement.organizationId, entitlement.feature), entitlement]));
  }

  private persist() {
    this.storage.write({
      schemaVersion: 1,
      apiKeySequence: this.apiKeySequence,
      organizations: [...this.organizations.values()],
      users: [...this.users.values()],
      sessions: [...this.sessions.values()],
      apiKeys: [...this.apiKeys.values()].map(apiKey => ({
        id: apiKey.id,
        organizationId: apiKey.organizationId,
        label: apiKey.label,
        preview: apiKey.preview,
        checksum: apiKey.checksum,
        status: apiKey.status,
        createdAt: apiKey.createdAt,
      })),
      entitlements: [...this.entitlements.values()],
    });
  }
}

export function mountLocalControlPlaneRoutes(api: Hono, provider: CloudControlPlaneProvider = new LocalControlPlaneProvider()) {
  const basePath = '/cloud-layer/control-plane';

  api.get(`${basePath}/status`, async c => {
    await provider.ready?.();
    return c.json(provider.status());
  });

  api.post(`${basePath}/bootstrap`, async c => {
    const body = await parseOptionalJsonBody(c.req.raw);
    if (!body.ok) return c.json(invalidJsonBody(), 400);
    const request = body.value as BootstrapRequest;
    const normalizedEmail = request.email === undefined ? undefined : normalizeEmail(request.email);
    if (request.email !== undefined && !normalizedEmail) return c.json(invalidEmailBody(), 400);
    const email = normalizedEmail ?? undefined;
    const organizationName = typeof request.organizationName === 'string' ? request.organizationName : undefined;
    await provider.ready?.();
    return c.json(provider.bootstrap({ organizationName, email }), 201);
  });

  api.post(`${basePath}/dev-login`, async c => {
    const body = await parseOptionalJsonBody(c.req.raw);
    if (!body.ok) return c.json(invalidJsonBody(), 400);
    const request = body.value as DevLoginRequest;
    const normalizedEmail = request.email === undefined ? undefined : normalizeEmail(request.email);
    if (request.email !== undefined && !normalizedEmail) return c.json(invalidEmailBody(), 400);
    const email = normalizedEmail ?? undefined;
    const organizationId = typeof request.organizationId === 'string' ? request.organizationId.trim() : undefined;
    await provider.ready?.();
    return c.json(provider.devLogin({ email, organizationId }), 200);
  });


  api.post(`${basePath}/simulated-email-login`, async c => {
    const body = await parseOptionalJsonBody(c.req.raw);
    if (!body.ok) return c.json(invalidJsonBody(), 400);
    const request = body.value as DevLoginRequest;
    const normalizedEmail = request.email === undefined ? undefined : normalizeEmail(request.email);
    if (request.email !== undefined && !normalizedEmail) return c.json(invalidEmailBody(), 400);
    const email = normalizedEmail ?? undefined;
    const organizationId = typeof request.organizationId === 'string' ? request.organizationId.trim() : undefined;
    await provider.ready?.();
    const result = provider.devLogin({ email, organizationId });
    c.header('Set-Cookie', simulatedSessionCookie(result.session.id, result.session.expiresAt));
    return c.json({
      ...result,
      localDevOnly: false,
      productionSecurity: false,
      simulatedEmailOnly: true,
      authBoundary: 'server-session-cookie',
      delivery: 'simulated-no-email-sent',
      message: 'Simulated email login completed for the Railway proof environment. No email was sent.',
    }, 200);
  });

  api.get(`${basePath}/org/current`, async c => {
    await provider.ready?.();
    return c.json(provider.currentTenant(c.req.header('X-Organization-Id')));
  });
  api.get(`${basePath}/api-keys`, async c => {
    await provider.ready?.();
    return c.json(provider.listApiKeys(c.req.header('X-Organization-Id')));
  });

  api.post(`${basePath}/api-keys`, async c => {
    const body = await parseOptionalJsonBody(c.req.raw);
    if (!body.ok) return c.json(invalidJsonBody(), 400);
    const request = body.value as CreateApiKeyRequest;
    const label = typeof request.label === 'string' ? request.label : undefined;
    await provider.ready?.();
    return c.json(provider.createApiKey({ label }, c.req.header('X-Organization-Id')), 201);
  });

  api.get(`${basePath}/entitlements/status`, async c => {
    await provider.ready?.();
    return c.json(provider.entitlementStatus(c.req.header('X-Organization-Id')));
  });
}

export function mountLocalControlPlaneShellRoutes(
  app: Hono,
  provider: LocalControlPlaneProvider,
  guard: (featureName: string) => (c: Context, next: Next) => Promise<Response | void>,
  runtime: CloudRuntimeState,
  policyConfig: CloudPolicyConfig
) {
  app.use('/api/v1/organizations/*', guard('Organizations API'));
  app.use('/api/v1/organizations', guard('Organizations API'));
  app.use('/api/v1/api-keys/*', guard('API Keys'));
  app.use('/api/v1/api-keys', guard('API Keys'));
  app.use('/api/v1/config/cloud', guard('Cloud Control Plane'));
  app.use('/api/v1/admin/diagnostics', guard('Cloud Control Plane'));

  app.get('/api/v1/organizations', async c => {
    await provider.ready();
    return c.json(provider.listOrganizations());
  });

  app.post('/api/v1/organizations', async c => {
    const body = await parseOptionalJsonBody(c.req.raw);
    if (!body.ok) return c.json(invalidJsonBody(), 400);
    try {
      const request = body.value as CreateOrganizationRequest;
      const name = typeof request.name === 'string' ? request.name : undefined;
      await provider.ready();
      return c.json(provider.createOrganization({ name }), 201);
    } catch (error) {
      return localControlPlaneErrorResponse(c, error);
    }
  });

  app.get('/api/v1/organizations/:organizationId/members', async c => {
    try {
      await provider.ready();
      return c.json(provider.listMembers(c.req.param('organizationId')));
    } catch (error) {
      return localControlPlaneErrorResponse(c, error);
    }
  });

  app.get('/api/v1/api-keys', async c => {
    await provider.ready();
    return c.json(provider.listApiKeys(c.req.header('X-Organization-Id')));
  });

  app.post('/api/v1/api-keys', async c => {
    const body = await parseOptionalJsonBody(c.req.raw);
    if (!body.ok) return c.json(invalidJsonBody(), 400);
    const request = body.value as CreateApiKeyRequest;
    const label = typeof request.label === 'string' ? request.label : undefined;
    await provider.ready();
    return c.json(provider.createApiKey({ label }, c.req.header('X-Organization-Id')), 201);
  });

  app.delete('/api/v1/api-keys/:keyId', async c => {
    try {
      await provider.ready();
      return c.json(provider.deleteApiKey(c.req.param('keyId'), c.req.header('X-Organization-Id')));
    } catch (error) {
      return localControlPlaneErrorResponse(c, error);
    }
  });

  app.get('/api/v1/config/cloud', async c => {
    await provider.ready();
    return c.json(provider.cloudConfigDiagnostics(runtime, policyConfig));
  });

  app.get('/api/v1/admin/diagnostics', async c => {
    if (!isDiagnosticAuthorization(c.req.header('Authorization'), policyConfig)) {
      return c.json({ success: false, code: 'DIAGNOSTIC_AUTH_REQUIRED', error: 'Diagnostic local operator authorization is required.' }, 403);
    }
    await provider.ready();
    return c.json(provider.adminDiagnostics());
  });
}

function safeProviderDiagnostics(descriptor: CloudControlPlaneProviderDescriptor): CloudControlPlaneSafeProviderDiagnostics {
  return {
    id: descriptor.id,
    kind: descriptor.kind,
    status: descriptor.status,
    storageKind: descriptor.storageKind,
    productionReady: descriptor.productionReady,
    contractVersion: descriptor.contractVersion,
    dataClasses: descriptor.dataClasses,
    redaction: 'safe-status-and-counts-only',
  };
}

async function parseOptionalJsonBody(request: Request): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false }> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return { ok: true, value: {} };
  try {
    const value = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ok: true, value: value as Record<string, unknown> }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value.trim();
  return label.length > 0 && label.length <= 80 ? label : null;
}

function normalizeOrganizationName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name.length > 0 && name.length <= 80 ? name : null;
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'organization';
}

class LocalControlPlaneError extends Error {
  constructor(readonly status: 400 | 404, readonly code: string, message: string) {
    super(message);
  }
}

function localControlPlaneErrorResponse(c: Context, error: unknown) {
  if (error instanceof LocalControlPlaneError) {
    return c.json({ success: false, code: error.code, error: error.message }, error.status);
  }
  throw error;
}

function isDiagnosticAuthorization(value: string | undefined, policyConfig: CloudPolicyConfig) {
  const prefix = 'payin-diagnostic ';
  if (!value?.toLowerCase().startsWith(prefix)) return false;
  const presented = value.slice(prefix.length).trim();
  return policyConfig.diagnosticAuthTokens.some(allowed => allowed === '*' || allowed === presented);
}

function entitlementKey(organizationId: string, feature: string) {
  return `${organizationId}:${feature}`;
}

function simulatedSessionCookie(sessionId: string, expiresAt: string) {
  return [
    `payin_cloud_session=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ].join('; ');
}

function invalidJsonBody() {
  return {
    success: false,
    code: 'INVALID_JSON',
    error: 'Request body must be a JSON object when provided.',
  };
}

function invalidEmailBody() {
  return {
    success: false,
    code: 'INVALID_EMAIL',
    error: 'A valid email field is required when provided.',
  };
}
