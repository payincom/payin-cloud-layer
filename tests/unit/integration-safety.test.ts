import { describe, expect, it } from 'vitest';
import {
  IntegrationSafetyError,
  assertDisposableIntegrationDatabaseUrl,
  shouldRunDisposableIntegration,
} from '../../src/index.js';

describe('Disposable integration safety contract', () => {
  it('does not run disposable integration tests unless explicitly enabled', () => {
    expect(shouldRunDisposableIntegration({})).toBe(false);
    expect(shouldRunDisposableIntegration({ PAYIN_CLOUD_LAYER_INTEGRATION: '0' })).toBe(false);
    expect(shouldRunDisposableIntegration({ PAYIN_CLOUD_LAYER_INTEGRATION: '1' })).toBe(true);
  });

  it('requires database URLs to be marked disposable/test', () => {
    expect(() => assertDisposableIntegrationDatabaseUrl('postgresql://user:pass@localhost:5432/payin_cloud_layer_test')).not.toThrow();
    expect(() => assertDisposableIntegrationDatabaseUrl('postgresql://user:pass@localhost:5432/payin_cloud_layer_disposable')).not.toThrow();
    expect(() => assertDisposableIntegrationDatabaseUrl('postgresql://user:pass@prod.example.com:5432/payin')).toThrow(IntegrationSafetyError);
    expect(() => assertDisposableIntegrationDatabaseUrl('')).toThrow('Integration database URL is required');
  });
});
