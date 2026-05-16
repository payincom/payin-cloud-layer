import { describe, expect, it } from 'vitest';
import {
  CLOUD_LAYER_MINIMAL_SCHEMA_TABLES,
  assertSafeSchemaSql,
  getCloudLayerMinimalSchemaSql,
} from '../../src/index.js';

describe('Cloud SQL schema fixture contract', () => {
  it('declares the minimal tables required by current SQL adapters', () => {
    expect(CLOUD_LAYER_MINIMAL_SCHEMA_TABLES).toEqual([
      'organizations',
      'organization_members',
      'api_keys',
      'orders',
      'paymentlinks',
      'address_pool',
      'webhook_endpoints',
      'usage_events',
      'audit_events',
    ]);
  });

  it('produces safe create-only schema SQL for disposable integration databases', () => {
    const sql = getCloudLayerMinimalSchemaSql();

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS organizations');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS orders');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS webhook_endpoints');
    expect(() => assertSafeSchemaSql(sql)).not.toThrow();
  });

  it('rejects dangerous schema SQL', () => {
    expect(() => assertSafeSchemaSql('DROP TABLE users;')).toThrow('Schema SQL contains forbidden statement: DROP');
    expect(() => assertSafeSchemaSql('ALTER SYSTEM SET log_statement = all;')).toThrow('Schema SQL contains forbidden statement: ALTER SYSTEM');
  });
});
