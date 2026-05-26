export type CloudControlPlaneProviderKind = 'local-dev' | 'railway-proof';
export type CloudControlPlaneProviderStatus = 'active';

export interface CloudControlPlaneOrganizationRecord {
  id: string;
  slug: string;
  name: string;
  mode: string;
  createdAt: string;
}

export interface CloudControlPlaneUserRecord {
  id: string;
  email: string;
  displayName: string;
  organizationIds: string[];
  createdAt: string;
}

export interface CloudControlPlaneSessionRecord {
  id: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  expiresAt: string;
}

export interface CloudControlPlaneApiKeyRecord {
  id: string;
  organizationId: string;
  label: string;
  preview: string;
  checksum: string;
  status: 'active' | 'revoked' | string;
  createdAt: string;
}

export interface CloudControlPlaneMemberRecord {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'member';
  status: 'active';
  createdAt: string;
}

export interface CloudControlPlaneConfigDiagnostics {
  localDevOnly: boolean;
  productionSecurity: false;
  mode: string;
  runtime: {
    name: string;
    healthMode: string;
  };
  policy: {
    mode: string;
    tenantHeader: string;
    authHeader: string;
    entitlementHeader: string;
    allowedTenants: number;
    allowedEntitlements: number;
    diagnosticOperators: number;
    apiKeys: number;
    entitlementTenantMappings: number;
  };
  provider: CloudControlPlaneSafeProviderDiagnostics;
  redaction: 'names-and-counts-only';
}

export interface CloudControlPlaneAdminDiagnostics {
  localDevOnly: boolean;
  productionSecurity: false;
  operator: {
    scheme: 'diagnostic';
    localOnly: true;
    authorized: true;
  };
  provider: CloudControlPlaneSafeProviderDiagnostics;
  dataClasses: CloudControlPlaneProviderDescriptor['dataClasses'];
  counts: CloudControlPlaneStatus['counts'];
  warnings: readonly string[];
}

export interface CloudControlPlaneSafeProviderDiagnostics {
  id: string;
  kind: CloudControlPlaneProviderKind;
  status: CloudControlPlaneProviderStatus;
  storageKind: string;
  productionReady: boolean;
  contractVersion: '2026-05-m7';
  dataClasses: CloudControlPlaneProviderDescriptor['dataClasses'];
  redaction: 'safe-status-and-counts-only';
}

export interface CloudControlPlaneProviderDescriptor {
  id: string;
  kind: CloudControlPlaneProviderKind;
  status: CloudControlPlaneProviderStatus;
  storageKind: string;
  productionReady: boolean;
  contractVersion: '2026-05-m7';
  dataClasses: readonly ['organizations', 'users', 'sessions', 'api-key-metadata', 'entitlements'];
  secretPolicy: {
    storesSecretMaterial: false;
    returnsProductionSecrets: false;
    localTestTokensOnly: boolean;
  };
  notes: readonly string[];
}

export interface CloudControlPlaneStatus {
  ok: boolean;
  provider: string;
  mode: string;
  productionSecurity: boolean;
  deterministic: boolean;
  storage: string;
  storageDescription: string;
  namespace: string;
  contracts: CloudControlPlaneProviderDescriptor;
  counts: {
    organizations: number;
    users: number;
    sessions: number;
    apiKeys: number;
  };
}

export interface CloudControlPlaneBootstrapRequest {
  organizationName?: string;
  email?: string;
}

export interface CloudControlPlaneBootstrapResult {
  localDevOnly: boolean;
  organization: CloudControlPlaneOrganizationRecord;
  user: CloudControlPlaneUserRecord;
  session: CloudControlPlaneSessionSummary;
  entitlements: CloudControlPlaneEntitlement[];
}

export interface CloudControlPlaneDevLoginRequest {
  email?: string;
  organizationId?: string;
}

export interface CloudControlPlaneDevLoginResult {
  authenticated: true;
  localDevOnly: boolean;
  productionSecurity: boolean;
  authBoundary?: 'local-preview' | 'server-session-cookie';
  user: CloudControlPlaneUserRecord;
  organization: CloudControlPlaneOrganizationRecord;
  session: CloudControlPlaneSessionSummary;
}

export interface CloudControlPlaneTenantResult {
  localDevOnly: boolean;
  tenant: {
    id: string;
    organizationId: string;
    source: 'header' | 'default-local';
  };
  organization: CloudControlPlaneOrganizationRecord;
  users: CloudControlPlaneUserRecord[];
}

export interface CloudControlPlaneApiKeysResult {
  localDevOnly: boolean;
  organizationId: string;
  apiKeys: CloudControlPlaneApiKeyRecord[];
}

export interface CloudControlPlaneOrganizationsResult {
  localDevOnly: boolean;
  organizations: CloudControlPlaneOrganizationRecord[];
}

export interface CloudControlPlaneCreateOrganizationRequest {
  name?: string;
}

export interface CloudControlPlaneCreateOrganizationResult {
  localDevOnly: boolean;
  organization: CloudControlPlaneOrganizationRecord;
  members: CloudControlPlaneMemberRecord[];
}

export interface CloudControlPlaneMembersResult {
  localDevOnly: boolean;
  organizationId: string;
  members: CloudControlPlaneMemberRecord[];
}

export interface CloudControlPlaneCreateApiKeyRequest {
  label?: string;
}

export interface CloudControlPlaneCreateApiKeyResult {
  localDevOnly: boolean;
  productionSecurity: boolean;
  apiKey: CloudControlPlaneApiKeyRecord;
  sensitiveMaterialReturned: false;
  message: string;
}

export interface CloudControlPlaneDeleteApiKeyResult {
  localDevOnly: boolean;
  organizationId: string;
  apiKey: CloudControlPlaneApiKeyRecord;
  deleted: true;
}

export interface CloudControlPlaneEntitlementsResult {
  localDevOnly: boolean;
  organizationId: string;
  evaluation: string;
  entitlements: CloudControlPlaneEntitlement[];
}

export interface CloudControlPlaneEntitlement {
  feature: string;
  granted: boolean;
  quota: {
    limit: number;
    used: number;
    remaining: number;
    reset: 'never';
  };
}

export interface CloudControlPlaneSessionSummary {
  id: string;
  sessionPreview: string;
  sensitiveMaterialReturned: false;
  userId: string;
  organizationId: string;
  expiresAt: string;
}

export interface CloudControlPlaneAuthService {
  devLogin(request?: CloudControlPlaneDevLoginRequest): CloudControlPlaneDevLoginResult;
}

export interface CloudControlPlaneOrganizationService {
  bootstrap(request?: CloudControlPlaneBootstrapRequest): CloudControlPlaneBootstrapResult;
  currentTenant(organizationId?: string | null): CloudControlPlaneTenantResult;
  listOrganizations(): CloudControlPlaneOrganizationsResult;
  createOrganization(request?: CloudControlPlaneCreateOrganizationRequest): CloudControlPlaneCreateOrganizationResult;
  listMembers(organizationId: string): CloudControlPlaneMembersResult;
}

export interface CloudControlPlaneApiKeyService {
  listApiKeys(organizationId?: string | null): CloudControlPlaneApiKeysResult;
  createApiKey(
    request?: CloudControlPlaneCreateApiKeyRequest,
    organizationId?: string | null
  ): CloudControlPlaneCreateApiKeyResult;
  deleteApiKey(keyId: string, organizationId?: string | null): CloudControlPlaneDeleteApiKeyResult;
}

export interface CloudControlPlaneEntitlementService {
  entitlementStatus(organizationId?: string | null): CloudControlPlaneEntitlementsResult;
}

export interface CloudControlPlaneProvider
  extends CloudControlPlaneAuthService,
    CloudControlPlaneOrganizationService,
    CloudControlPlaneApiKeyService,
    CloudControlPlaneEntitlementService {
  readonly descriptor: CloudControlPlaneProviderDescriptor;
  status(): CloudControlPlaneStatus;
  ready?(): Promise<void>;
}

export function sessionSummary(session: CloudControlPlaneSessionRecord): CloudControlPlaneSessionSummary {
  return {
    id: session.id,
    sessionPreview: `${session.id.slice(0, 18)}_preview_only`,
    sensitiveMaterialReturned: false,
    userId: session.userId,
    organizationId: session.organizationId,
    expiresAt: session.expiresAt,
  };
}
