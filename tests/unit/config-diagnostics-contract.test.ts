import { describe, expect, it } from 'vitest';
import {
  createCloudConfigDiagnostics,
  sanitizeCloudMonitorConfig,
  sanitizeCloudSecretLikeValue,
  toLegacyConfigDiagnosticsResponse,
} from '../../src/index.js';

describe('Cloud config diagnostics contract', () => {
  it('sanitizes configured monitor RPC secrets while preserving unresolved env placeholders', () => {
    expect(sanitizeCloudSecretLikeValue('alchemy-real-secret')).toBe('[configured]');
    expect(sanitizeCloudSecretLikeValue('${ALCHEMY_API_KEY}')).toBe('${ALCHEMY_API_KEY}');
    expect(sanitizeCloudSecretLikeValue(123)).toBe(123);

    expect(sanitizeCloudMonitorConfig({
      chains: ['ethereum-sepolia'],
      rpcKeys: {
        alchemy: 'alchemy-real-secret',
        infura: '${INFURA_API_KEY}',
        publicnode: '',
      },
      customProviders: { ethereum: 'https://example.invalid/rpc' },
    })).toEqual({
      chains: ['ethereum-sepolia'],
      rpcKeys: {
        alchemy: '[configured]',
        infura: '${INFURA_API_KEY}',
        publicnode: '',
      },
      customProviders: { ethereum: 'https://example.invalid/rpc' },
    });
  });

  it('builds the old Cloud diagnostics payload without importing old runtime modules', () => {
    const diagnostics = createCloudConfigDiagnostics({
      timestamp: new Date('2026-05-17T05:05:00.000Z'),
      nodeEnv: 'test',
      managerConfigFile: '/app/config/manager.yml',
      runtimeConfig: { apiBaseUrl: 'https://api.example' },
      managerMonitorConfig: {
        chains: ['ethereum-sepolia'],
        rpcKeys: { alchemy: 'secret', publicnode: '${PUBLICNODE_KEY}' },
      },
      monitorDiagnostics: {
        requestedChains: ['ethereum-sepolia'],
        skippedProviders: ['alchemy'],
        unresolvedApiKeys: [{ key: 'publicnode', value: '${PUBLICNODE_KEY}' }],
        validation: { valid: true },
        buildError: null,
      },
    });

    expect(diagnostics).toEqual({
      timestamp: '2026-05-17T05:05:00.000Z',
      nodeEnv: 'test',
      managerConfigFile: '/app/config/manager.yml',
      runtimeConfig: { apiBaseUrl: 'https://api.example' },
      managerMonitorConfig: {
        chains: ['ethereum-sepolia'],
        rpcKeys: { alchemy: '[configured]', publicnode: '${PUBLICNODE_KEY}' },
      },
      monitorDiagnostics: {
        requestedChains: ['ethereum-sepolia'],
        skippedProviders: ['alchemy'],
        unresolvedApiKeys: [{ key: 'publicnode', value: '${PUBLICNODE_KEY}' }],
        validation: { valid: true },
        buildError: null,
      },
    });
  });

  it('keeps legacy success/data envelope compatibility for diagnostics routes', () => {
    const diagnostics = createCloudConfigDiagnostics({ timestamp: new Date('2026-05-17T05:06:00.000Z') });

    expect(toLegacyConfigDiagnosticsResponse(diagnostics)).toEqual({ success: true, data: diagnostics });
  });
});
