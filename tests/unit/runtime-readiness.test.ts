import { describe, expect, it } from 'vitest';
import {
  createRuntimeReadinessReport,
  redactRuntimeDiagnostic,
  summarizeRuntimeReadiness,
  type RuntimeReadinessCheck,
} from '../../src/index.js';

const tenant = { organizationId: 'org-ready', tenantId: 'org-ready' };

describe('Cloud hosted runtime readiness contract', () => {
  it('summarizes tenant-scoped readiness checks', () => {
    const report = createRuntimeReadinessReport({
      tenant,
      checks: [
        { name: 'config', status: 'pass', message: 'tenant config loaded' },
        { name: 'monitor', status: 'warn', message: 'monitor lag is elevated' },
        { name: 'webhook', status: 'fail', message: 'no webhook endpoint configured', remediation: 'Create a webhook endpoint' },
      ],
    });

    expect(report).toMatchObject({
      tenant,
      status: 'fail',
      totals: { pass: 1, warn: 1, fail: 1 },
      checks: [
        { name: 'config', status: 'pass' },
        { name: 'monitor', status: 'warn' },
        { name: 'webhook', status: 'fail', remediation: 'Create a webhook endpoint' },
      ],
    });
  });

  it('treats warnings as warn status when there are no failures', () => {
    expect(summarizeRuntimeReadiness([
      { name: 'config', status: 'pass' },
      { name: 'monitor', status: 'warn' },
    ])).toEqual({ status: 'warn', totals: { pass: 1, warn: 1, fail: 0 } });
  });

  it('redacts secrets from diagnostics', () => {
    const check: RuntimeReadinessCheck = {
      name: 'config',
      status: 'fail',
      message: 'bad config',
      details: {
        databaseUrl: 'postgres://secret',
        apiKey: 'pk_live_secret',
        secretRef: 'secret://safe/ref',
        nested: { authorization: 'Bearer token' },
      },
    };

    expect(redactRuntimeDiagnostic(check)).toEqual({
      name: 'config',
      status: 'fail',
      message: 'bad config',
      details: {
        databaseUrl: '[REDACTED]',
        apiKey: '[REDACTED]',
        secretRef: 'secret://safe/ref',
        nested: { authorization: '[REDACTED]' },
      },
    });
  });

  it('keeps diagnostics tenant scoped and machine-readable', () => {
    const report = createRuntimeReadinessReport({
      tenant,
      checkedAt: new Date('2026-05-16T14:00:00.000Z'),
      checks: [{ name: 'chains.ethereum-sepolia', status: 'pass', details: { latestBlock: 123 } }],
    });

    expect(report).toEqual({
      tenant,
      checkedAt: new Date('2026-05-16T14:00:00.000Z'),
      status: 'pass',
      totals: { pass: 1, warn: 0, fail: 0 },
      checks: [{ name: 'chains.ethereum-sepolia', status: 'pass', details: { latestBlock: 123 } }],
    });
  });
});
