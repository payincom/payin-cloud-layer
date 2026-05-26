import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

export type LocalControlPlaneStorageKind = 'in-memory' | 'local-json-file' | 'postgres';

export type LocalApiKeyStatus = 'active' | 'revoked';

export interface LocalOrganizationRecord {
  id: string;
  slug: string;
  name: string;
  mode: 'local-dev';
  createdAt: string;
}

export interface LocalUserRecord {
  id: string;
  email: string;
  displayName: string;
  organizationIds: string[];
  createdAt: string;
}

export interface LocalSessionRecord {
  id: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  expiresAt: string;
}

export interface LocalApiKeyRecord {
  id: string;
  organizationId: string;
  label: string;
  preview: string;
  checksum: string;
  status: LocalApiKeyStatus;
  createdAt: string;
}

export interface LocalEntitlementRecord {
  organizationId: string;
  feature: string;
  granted: boolean;
  quotaLimit: number;
  quotaUsed: number;
  reset: 'never';
}

export interface LocalControlPlaneSnapshot {
  schemaVersion: 1;
  apiKeySequence: number;
  organizations: LocalOrganizationRecord[];
  users: LocalUserRecord[];
  sessions: LocalSessionRecord[];
  apiKeys: LocalApiKeyRecord[];
  entitlements: LocalEntitlementRecord[];
}

export interface LocalControlPlaneStorage {
  readonly kind: LocalControlPlaneStorageKind;
  readonly description: string;
  readonly ready?: Promise<void>;
  read(): LocalControlPlaneSnapshot;
  write(snapshot: LocalControlPlaneSnapshot): void;
}

export interface LocalJsonFileStorageOptions {
  path: string;
  enabled: boolean;
}

export function emptyLocalControlPlaneSnapshot(): LocalControlPlaneSnapshot {
  return {
    schemaVersion: 1,
    apiKeySequence: 1,
    organizations: [],
    users: [],
    sessions: [],
    apiKeys: [],
    entitlements: [],
  };
}

export class InMemoryLocalControlPlaneStorage implements LocalControlPlaneStorage {
  readonly kind = 'in-memory' as const;
  readonly description = 'process-local memory';

  private snapshot = emptyLocalControlPlaneSnapshot();

  read() {
    return cloneSnapshot(this.snapshot);
  }

  write(snapshot: LocalControlPlaneSnapshot) {
    this.snapshot = cloneSnapshot(snapshot);
  }
}

export class LocalJsonFileControlPlaneStorage implements LocalControlPlaneStorage {
  readonly kind = 'local-json-file' as const;
  readonly description: string;
  readonly path: string;

  constructor(options: LocalJsonFileStorageOptions) {
    if (!options.enabled) {
      throw new Error('Local JSON control-plane storage requires explicit non-production enablement.');
    }
    this.path = resolve(options.path);
    if (isProtectedLocalStoragePath(this.path)) {
      throw new Error('Local JSON control-plane storage refuses .env, credential, secret, or key file paths.');
    }
    this.description = `local dev JSON file: ${this.path}`;
  }

  read() {
    if (!existsSync(this.path)) return emptyLocalControlPlaneSnapshot();
    const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as unknown;
    return normalizeSnapshot(parsed);
  }

  write(snapshot: LocalControlPlaneSnapshot) {
    const safeSnapshot = normalizeSnapshot(snapshot);
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(safeSnapshot, null, 2)}\n`, { mode: 0o600 });
  }
}

export function createLocalControlPlaneStorageFromEnv(env: NodeJS.ProcessEnv = process.env): LocalControlPlaneStorage {
  const enabled = env.PAYIN_CLOUD_LOCAL_CONTROL_PLANE_DURABLE === 'true';
  const path = env.PAYIN_CLOUD_LOCAL_CONTROL_PLANE_FILE;
  if (!enabled || !path) return new InMemoryLocalControlPlaneStorage();
  return new LocalJsonFileControlPlaneStorage({ path, enabled });
}

function cloneSnapshot(snapshot: LocalControlPlaneSnapshot): LocalControlPlaneSnapshot {
  return normalizeSnapshot(JSON.parse(JSON.stringify(snapshot)));
}

function normalizeSnapshot(value: unknown): LocalControlPlaneSnapshot {
  if (!value || typeof value !== 'object') return emptyLocalControlPlaneSnapshot();
  const candidate = value as Partial<LocalControlPlaneSnapshot>;
  const organizations = arrayOf(candidate.organizations, isOrganizationRecord);
  const organizationIds = new Set(organizations.map(organization => organization.id));
  const users = arrayOf(candidate.users, isUserRecord).map(user => ({
    ...user,
    organizationIds: uniqueStrings(user.organizationIds).filter(organizationId => organizationIds.has(organizationId)),
  }));
  const usersById = new Map(users.map(user => [user.id, user]));
  const sessions = arrayOf(candidate.sessions, isSessionRecord).filter(session => {
    const user = usersById.get(session.userId);
    return organizationIds.has(session.organizationId) && Boolean(user?.organizationIds.includes(session.organizationId));
  });
  const apiKeys = arrayOf(candidate.apiKeys, isApiKeyRecord).filter(apiKey => organizationIds.has(apiKey.organizationId));
  const entitlements = arrayOf(candidate.entitlements, isEntitlementRecord)
    .filter(entitlement => organizationIds.has(entitlement.organizationId))
    .map(entitlement => ({
      ...entitlement,
      quotaUsed: Math.min(entitlement.quotaUsed, entitlement.quotaLimit),
    }));
  const nextApiKeySequence = Math.max(
    positiveInteger(candidate.apiKeySequence) ?? 1,
    ...apiKeys.map(apiKey => sequenceFromLocalId(apiKey.id) + 1)
  );
  return {
    schemaVersion: 1,
    apiKeySequence: nextApiKeySequence,
    organizations,
    users,
    sessions,
    apiKeys,
    entitlements,
  };
}

function arrayOf<T>(value: unknown, predicate: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(predicate) : [];
}

function positiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function isOrganizationRecord(value: unknown): value is LocalOrganizationRecord {
  const record = value as LocalOrganizationRecord;
  return isObject(record) && isString(record.id) && isString(record.slug) && isString(record.name) && record.mode === 'local-dev' && isString(record.createdAt) && !hasSecretMaterial(record);
}

function isUserRecord(value: unknown): value is LocalUserRecord {
  const record = value as LocalUserRecord;
  return isObject(record) && isString(record.id) && isString(record.email) && isString(record.displayName) && Array.isArray(record.organizationIds) && record.organizationIds.every(isString) && isString(record.createdAt) && !hasSecretMaterial(record);
}

function isSessionRecord(value: unknown): value is LocalSessionRecord {
  const record = value as LocalSessionRecord;
  return isObject(record) && isString(record.id) && isString(record.userId) && isString(record.organizationId) && isString(record.createdAt) && isString(record.expiresAt) && !hasSecretMaterial(record);
}

function isApiKeyRecord(value: unknown): value is LocalApiKeyRecord {
  const record = value as LocalApiKeyRecord;
  return isObject(record) && isString(record.id) && isString(record.organizationId) && isString(record.label) && isString(record.preview) && isString(record.checksum) && (record.status === 'active' || record.status === 'revoked') && isString(record.createdAt) && !hasSecretMaterial(record);
}

function isEntitlementRecord(value: unknown): value is LocalEntitlementRecord {
  const record = value as LocalEntitlementRecord;
  return isObject(record) && isString(record.organizationId) && isString(record.feature) && typeof record.granted === 'boolean' && nonNegativeFinite(record.quotaLimit) && nonNegativeFinite(record.quotaUsed) && record.reset === 'never' && !hasSecretMaterial(record);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function hasSecretMaterial(record: Record<string, unknown>) {
  return Object.keys(record).some(key => /secret|token|credential|private/i.test(key));
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function sequenceFromLocalId(id: string) {
  const match = id.match(/^cpak_local_(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function nonNegativeFinite(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isProtectedLocalStoragePath(path: string) {
  return /(^\.env(?:\.|$)|secret|credential|private|\.pem$|\.key$)/i.test(basename(path));
}
