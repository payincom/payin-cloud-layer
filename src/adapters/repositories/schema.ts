import type { SqlQueryExecutor } from './sql.js';

export const CLOUD_LAYER_MINIMAL_SCHEMA_TABLES = [
  'organizations',
  'organization_members',
  'api_keys',
  'orders',
  'paymentlinks',
  'address_pool',
  'webhook_endpoints',
  'usage_events',
  'audit_events',
] as const;

const FORBIDDEN_SCHEMA_STATEMENTS = ['DROP', 'TRUNCATE', 'ALTER SYSTEM', 'CREATE DATABASE', 'DROP DATABASE'] as const;

export function getCloudLayerMinimalSchemaSql(): string {
  return `
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  website TEXT,
  description TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free',
  monthly_order_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organization_members (
  id BIGSERIAL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  invited_by TEXT,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT,
  capabilities TEXT[],
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  order_reference TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_address TEXT,
  confirmed_received TEXT NOT NULL DEFAULT '0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paymentlinks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  chain_options TEXT[] NOT NULL,
  status TEXT NOT NULL,
  slug TEXT,
  inventory_total INTEGER,
  inventory_reserved INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS address_pool (
  address TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  protocol TEXT NOT NULL,
  state TEXT NOT NULL,
  derivation_index INTEGER,
  master_public_key_ref TEXT,
  deposit_reference TEXT,
  order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  url TEXT NOT NULL,
  event_types TEXT[] NOT NULL,
  signing_secret_ref TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_events (
  dedupe_key TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL,
  subject_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  subject_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB
);
`;
}

export function assertSafeSchemaSql(sql: string): void {
  const upper = sql.toUpperCase();
  for (const forbidden of FORBIDDEN_SCHEMA_STATEMENTS) {
    if (upper.includes(forbidden)) {
      throw new Error(`Schema SQL contains forbidden statement: ${forbidden}`);
    }
  }
}

export async function applyCloudLayerSchema(db: SqlQueryExecutor, sql = getCloudLayerMinimalSchemaSql()): Promise<void> {
  assertSafeSchemaSql(sql);
  for (const statement of splitSqlStatements(sql)) {
    await db.query(statement, []);
  }
}

export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}
