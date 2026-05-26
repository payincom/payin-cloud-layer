import type { Context, Next } from 'hono';
import type { OpenCloudOnlyRouteGuard } from '@payin/app/runtime-contract';
import { createLocalCloudPolicyProviders } from './cloud-policy-providers.js';

type CloudOnlyRouteGuard = OpenCloudOnlyRouteGuard;
type LocalCloudOnlyRouteGuard = (featureName: string) => (c: Context, next: Next) => Promise<Response | void>;

export type CloudPolicyMode = 'enforce' | 'report-only' | 'off';
type CloudPolicyDecision = 'allow' | 'deny';

export interface CloudPolicyConfig {
  mode: CloudPolicyMode;
  tenantHeader: string;
  authHeader: string;
  entitlementHeader: string;
  allowedTenants: readonly string[];
  allowedEntitlements: readonly string[];
  allowBearerAuth: boolean;
  diagnosticAuthTokens: readonly string[];
  apiKeys: readonly string[];
  entitlementsByTenant: Readonly<Record<string, readonly string[]>>;
  auditEnabled: boolean;
}

export interface CloudTenantContext {
  tenantId: string | null;
  source: 'header' | 'missing' | 'not-allowed';
}

export interface CloudAuthContext {
  present: boolean;
  scheme: 'bearer' | 'api-key' | 'diagnostic' | 'unknown' | 'missing';
}

export interface CloudEntitlementContext {
  requested: string;
  granted: boolean;
  source: 'header' | 'tenant-map' | 'global' | 'missing';
}

export interface CloudAuditEvent {
  featureName: string;
  path: string;
  method: string;
  tenantId: string | null;
  authScheme: CloudAuthContext['scheme'];
  entitlement: CloudEntitlementContext;
  decision: CloudPolicyDecision;
  reason: string;
  mode: CloudPolicyMode;
}

export interface CloudTenantResolver {
  resolve(c: Context, config: CloudPolicyConfig): CloudTenantContext;
}

export interface CloudAuthProvider {
  authenticate(c: Context, config: CloudPolicyConfig): CloudAuthContext;
}

export interface CloudEntitlementProvider {
  evaluate(
    c: Context,
    featureName: string,
    tenant: CloudTenantContext,
    auth: CloudAuthContext,
    config: CloudPolicyConfig
  ): CloudEntitlementContext;
}

export interface CloudAuditSink {
  record(event: CloudAuditEvent): void;
}

export interface CloudPolicyDependencies {
  tenantResolver?: CloudTenantResolver;
  authProvider?: CloudAuthProvider;
  entitlementProvider?: CloudEntitlementProvider;
  auditSink?: CloudAuditSink;
}

export interface CloudPolicyRuntime {
  config: CloudPolicyConfig;
  guard: CloudOnlyRouteGuard;
}

const defaultProviders = createLocalCloudPolicyProviders();

const defaultAuditSink: CloudAuditSink = {
  record(event) {
    console.info(
      JSON.stringify({
        event: 'payin.cloud.policy',
        featureName: event.featureName,
        path: event.path,
        method: event.method,
        tenantId: event.tenantId,
        authScheme: event.authScheme,
        entitlement: event.entitlement.requested,
        decision: event.decision,
        reason: event.reason,
        mode: event.mode,
      })
    );
  },
};

export function loadCloudPolicyConfig(env: NodeJS.ProcessEnv = process.env): CloudPolicyConfig {
  const requestedMode = env.PAYIN_CLOUD_POLICY_MODE;
  const mode: CloudPolicyMode =
    requestedMode === 'off' || requestedMode === 'report-only' ? requestedMode : 'enforce';

  return {
    mode,
    tenantHeader: env.PAYIN_CLOUD_TENANT_HEADER ?? 'X-Organization-Id',
    authHeader: env.PAYIN_CLOUD_AUTH_HEADER ?? 'Authorization',
    entitlementHeader: env.PAYIN_CLOUD_ENTITLEMENT_HEADER ?? 'X-PayIn-Cloud-Entitlement',
    allowedTenants: parseCsv(env.PAYIN_CLOUD_ALLOWED_TENANTS),
    allowedEntitlements: parseCsv(env.PAYIN_CLOUD_ALLOWED_ENTITLEMENTS),
    allowBearerAuth: isTrueLikeEnvValue(env.PAYIN_CLOUD_ALLOW_BEARER_AUTH),
    diagnosticAuthTokens: parseCsv(env.PAYIN_CLOUD_DIAGNOSTIC_AUTH_TOKENS),
    apiKeys: parseCsv(env.PAYIN_CLOUD_API_KEYS),
    entitlementsByTenant: parseTenantEntitlementMap(env.PAYIN_CLOUD_ENTITLEMENTS_BY_TENANT),
    auditEnabled: env.PAYIN_CLOUD_AUDIT_ENABLED !== 'false',
  };
}

export function createCloudPolicyRuntime(
  config: CloudPolicyConfig = loadCloudPolicyConfig(),
  dependencies: CloudPolicyDependencies = {}
): CloudPolicyRuntime {
  const tenantResolver = dependencies.tenantResolver ?? defaultProviders.tenantResolver;
  const authProvider = dependencies.authProvider ?? defaultProviders.authProvider;
  const entitlementProvider = dependencies.entitlementProvider ?? defaultProviders.entitlementProvider;
  const auditSink = dependencies.auditSink ?? defaultAuditSink;

  const guard: LocalCloudOnlyRouteGuard = featureName => async (c: Context, next: Next) => {
    if (isPublicCompatibilityRoute(featureName, c)) {
      applyPolicyHeaders(c, {
        mode: config.mode,
        decision: 'allow',
        reason: 'public_compatibility_route',
        tenantSource: 'missing',
        authScheme: 'missing',
        entitlementSource: 'missing',
      });
      await next();
      return;
    }

    const tenant = tenantResolver.resolve(c, config);
    const auth = authProvider.authenticate(c, config);
    const entitlement = entitlementProvider.evaluate(c, featureName, tenant, auth, config);
    const missingReasons = [
      tenant.tenantId ? null : 'tenant_required',
      tenant.source === 'not-allowed' ? 'tenant_not_allowed' : null,
      auth.present ? null : 'auth_required',
      entitlement.granted ? null : 'entitlement_required',
    ].filter((reason): reason is string => Boolean(reason));
    const reason = missingReasons[0] ?? 'allowed';
    const wouldAllow = missingReasons.length === 0;
    const decision: CloudPolicyDecision =
      config.mode === 'off' || config.mode === 'report-only' || wouldAllow ? 'allow' : 'deny';

    c.header('X-PayIn-Cloud-Layer', 'mvp');
    c.header('X-PayIn-Cloud-Feature', featureName);
    c.header('X-PayIn-Cloud-Policy-Mode', config.mode);
    c.header('X-PayIn-Cloud-Policy-Decision', decision);
    c.header('X-PayIn-Cloud-Policy-Reason', reason);
    c.header('X-PayIn-Cloud-Tenant-Source', tenant.source);
    c.header('X-PayIn-Cloud-Auth-Scheme', auth.scheme);
    c.header('X-PayIn-Cloud-Entitlement-Source', entitlement.source);

    if (config.auditEnabled) {
      auditSink.record({
        featureName,
        path: c.req.path,
        method: c.req.method,
        tenantId: tenant.tenantId,
        authScheme: auth.scheme,
        entitlement,
        decision,
        reason,
        mode: config.mode,
      });
    }

    if (decision === 'deny') {
      return c.json(
        {
          success: false,
          error: 'Cloud policy denied',
          code: 'CLOUD_POLICY_DENIED',
          featureName,
          reason,
          policy: cloudPolicyStatus(config),
        },
        403
      );
    }

    await next();
  };

  return { config, guard: guard as unknown as CloudOnlyRouteGuard };
}


function isPublicCompatibilityRoute(featureName: string, c: Context): boolean {
  return featureName === 'OAuth API' && c.req.method === 'GET' && c.req.path.endsWith('/auth/oauth/config');
}

function isTrueLikeEnvValue(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

interface PolicyHeaderState {
  mode: CloudPolicyMode;
  decision: CloudPolicyDecision;
  reason: string;
  tenantSource: CloudTenantContext['source'];
  authScheme: CloudAuthContext['scheme'];
  entitlementSource: CloudEntitlementContext['source'];
}

function applyPolicyHeaders(c: Context, state: PolicyHeaderState) {
  c.header('X-PayIn-Cloud-Layer', 'mvp');
  c.header('X-PayIn-Cloud-Policy-Mode', state.mode);
  c.header('X-PayIn-Cloud-Policy-Decision', state.decision);
  c.header('X-PayIn-Cloud-Policy-Reason', state.reason);
  c.header('X-PayIn-Cloud-Tenant-Source', state.tenantSource);
  c.header('X-PayIn-Cloud-Auth-Scheme', state.authScheme);
  c.header('X-PayIn-Cloud-Entitlement-Source', state.entitlementSource);
}

export function cloudPolicyStatus(config: CloudPolicyConfig) {
  return {
    mode: config.mode,
    tenantHeader: config.tenantHeader,
    authHeader: config.authHeader,
    entitlementHeader: config.entitlementHeader,
    allowedTenants: config.allowedTenants.length,
    allowedEntitlements: config.allowedEntitlements.length,
    diagnosticOperators: config.diagnosticAuthTokens.length,
    apiKeys: config.apiKeys.length,
    entitlementTenantMappings: Object.keys(config.entitlementsByTenant).length,
    auditEnabled: config.auditEnabled,
    defaultBehavior:
      config.mode === 'enforce'
        ? 'deny Cloud-only routes until tenant, auth, and entitlement are present'
        : 'allow Cloud-only routes while emitting diagnostics',
  };
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseTenantEntitlementMap(value: string | undefined): Record<string, string[]> {
  const entries = (value ?? '')
    .split(';')
    .map(entry => entry.trim())
    .filter(Boolean);

  return Object.fromEntries(
    entries.flatMap(entry => {
      const separatorIndex = entry.indexOf(':');
      if (separatorIndex <= 0) return [];
      const tenantId = entry.slice(0, separatorIndex).trim();
      const entitlements = entry
        .slice(separatorIndex + 1)
        .split('|')
        .map(entitlement => entitlement.trim())
        .filter(Boolean);
      return tenantId && entitlements.length > 0 ? [[tenantId, entitlements]] : [];
    })
  );
}
