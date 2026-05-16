export const CLOUD_LAYER_MINIMAL_SCHEMA_TABLES = [
  'organizations',
  'organization_members',
  'api_keys',
  'orders',
  'paymentlinks',
  'address_pool',
  'webhook_endpoints',
] as const;

const FORBIDDEN_SCHEMA_STATEMENTS = ['DROP', 'TRUNCATE', 'ALTER SYSTEM', 'CREATE DATABASE', 'DROP DATABASE'] as const;

export function getCloudLayerMinimalSchemaSql(): string {
  return `
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
