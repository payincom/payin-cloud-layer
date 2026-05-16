import { describe, expect, it } from 'vitest';
import {
  assertDisposableIntegrationDatabaseUrl,
  getCloudLayerMinimalSchemaSql,
  shouldRunDisposableIntegration,
} from '../../src/index.js';

const enabled = shouldRunDisposableIntegration();

describe.runIf(enabled)('disposable database integration', () => {
  it('requires an explicitly disposable DATABASE_URL before running schema setup', () => {
    const databaseUrl = process.env.DATABASE_URL ?? process.env.DB_CONNECTION_STRING ?? '';
    expect(() => assertDisposableIntegrationDatabaseUrl(databaseUrl)).not.toThrow();
  });

  it('has schema SQL ready for disposable setup', () => {
    const sql = getCloudLayerMinimalSchemaSql();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS organizations');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS webhook_endpoints');
  });
});

describe.skipIf(enabled)('disposable database integration disabled', () => {
  it('documents the opt-in gate', () => {
    expect(shouldRunDisposableIntegration()).toBe(false);
    expect(process.env.PAYIN_CLOUD_LAYER_INTEGRATION).not.toBe('1');
  });
});
