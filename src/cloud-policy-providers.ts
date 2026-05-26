import type { Context } from 'hono';
import type {
  CloudAuthContext,
  CloudAuthProvider,
  CloudEntitlementContext,
  CloudEntitlementProvider,
  CloudPolicyConfig,
  CloudTenantResolver,
} from './cloud-policy.js';

export type CloudTenantSource = 'header' | 'missing' | 'not-allowed';
export type CloudEntitlementSource = 'header' | 'tenant-map' | 'global' | 'missing';

export interface LocalCloudPolicyProviderConfig {
  allowedTenants: readonly string[];
  allowBearerAuth: boolean;
  diagnosticAuthTokens: readonly string[];
  apiKeys: readonly string[];
  entitlementsByTenant: Readonly<Record<string, readonly string[]>>;
}

export interface LocalCloudPolicyProviders {
  tenantResolver: CloudTenantResolver;
  authProvider: CloudAuthProvider;
  entitlementProvider: CloudEntitlementProvider;
}

export function createLocalCloudPolicyProviders(): LocalCloudPolicyProviders {
  return {
    tenantResolver: createAllowlistTenantResolver(),
    authProvider: createLocalAuthProvider(),
    entitlementProvider: createMappedEntitlementProvider(),
  };
}

function createAllowlistTenantResolver(): CloudTenantResolver {
  return {
    resolve(c, config) {
      const tenantId = c.req.header(config.tenantHeader)?.trim() || null;
      if (!tenantId) return { tenantId: null, source: 'missing' };
      if (allowsValue(config.allowedTenants, tenantId)) return { tenantId, source: 'header' };
      return { tenantId, source: 'not-allowed' };
    },
  };
}

function createLocalAuthProvider(): CloudAuthProvider {
  return {
    authenticate(c, config) {
      const credential = c.req.header(config.authHeader)?.trim();
      if (!credential) return { present: false, scheme: 'missing' };

      const diagnosticToken = readPrefixedCredential(credential, 'payin-diagnostic');
      if (diagnosticToken) {
        return {
          present: allowsValue(config.diagnosticAuthTokens, diagnosticToken),
          scheme: 'diagnostic',
        };
      }

      const bearerToken = readPrefixedCredential(credential, 'bearer');
      if (bearerToken && config.allowBearerAuth) return { present: true, scheme: 'bearer' };

      return {
        present: allowsValue(config.apiKeys, credential),
        scheme: credential.length > 0 ? 'api-key' : 'unknown',
      };
    },
  };
}

function createMappedEntitlementProvider(): CloudEntitlementProvider {
  return {
    evaluate(c, featureName, tenant, auth, config) {
      const requested = c.req.header(config.entitlementHeader)?.trim() || featureName;
      const tenantEntitlements = tenant.tenantId ? (config.entitlementsByTenant[tenant.tenantId] ?? []) : [];
      const source = entitlementSource(c, config, tenantEntitlements);
      const granted = Boolean(
        tenant.source === 'header' &&
          auth.present &&
          (allowsValue(tenantEntitlements, requested) || allowsValue(config.allowedEntitlements, requested))
      );

      return { requested, granted, source };
    },
  };
}

function entitlementSource(
  c: Context,
  config: CloudPolicyConfig,
  tenantEntitlements: readonly string[]
): CloudEntitlementContext['source'] {
  if (c.req.header(config.entitlementHeader)?.trim()) return 'header';
  if (tenantEntitlements.length > 0) return 'tenant-map';
  if (config.allowedEntitlements.length > 0) return 'global';
  return 'missing';
}

function readPrefixedCredential(credential: string, prefix: string): string | null {
  const normalizedPrefix = `${prefix.toLowerCase()} `;
  if (!credential.toLowerCase().startsWith(normalizedPrefix)) return null;
  return credential.slice(normalizedPrefix.length).trim() || null;
}

function allowsValue(allowedValues: readonly string[], value: string): boolean {
  return allowedValues.some(allowedValue => allowedValue === '*' || allowedValue === value);
}
