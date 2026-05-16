import { describe, expect, it } from 'vitest';
import {
  InMemoryCloudAuditTrail,
  StaticRiskDecisionProvider,
  createCloudAuditEvent,
  createSupportAccessGrant,
  redactCloudAuditMetadata,
  requireSupportAccess,
} from '../../src/index.js';

const tenant = { organizationId: 'org-audit', tenantId: 'org-audit' };

describe('Cloud audit/risk/support contract', () => {
  it('creates tenant-scoped audit events and redacts sensitive metadata', async () => {
    const audit = createCloudAuditEvent({
      tenant,
      action: 'api-keys:create',
      actor: { type: 'user', id: 'user-1' },
      subjectId: 'key-1',
      metadata: {
        apiKey: 'pk_live_secret',
        nested: { password: 'secret', safe: 'ok' },
      },
    });

    expect(audit).toMatchObject({
      tenant,
      action: 'api-keys:create',
      actor: { type: 'user', id: 'user-1' },
      subjectId: 'key-1',
      metadata: { apiKey: '[REDACTED]', nested: { password: '[REDACTED]', safe: 'ok' } },
    });
    expect(JSON.stringify(audit)).not.toContain('pk_live_secret');
  });

  it('stores and filters audit events by tenant/action', async () => {
    const trail = new InMemoryCloudAuditTrail();
    await trail.record(createCloudAuditEvent({ tenant, action: 'orders:create', actor: { type: 'api_key', id: 'key-1' } }));
    await trail.record(createCloudAuditEvent({ tenant, action: 'webhooks:test', actor: { type: 'user', id: 'user-1' } }));
    await trail.record(createCloudAuditEvent({ tenant: { organizationId: 'org-other' }, action: 'orders:create', actor: { type: 'user', id: 'user-2' } }));

    expect(await trail.list({ tenantId: 'org-audit', action: 'orders:create' })).toMatchObject([
      { action: 'orders:create', tenant: { organizationId: 'org-audit' } },
    ]);
  });

  it('redacts common sensitive metadata keys recursively', () => {
    expect(redactCloudAuditMetadata({
      token: 't',
      secretRef: 'secret://ok',
      privateKey: 'pk',
      dbUrl: 'postgres://secret',
      safe: ['x', { authorization: 'bearer' }],
    })).toEqual({
      token: '[REDACTED]',
      secretRef: 'secret://ok',
      privateKey: '[REDACTED]',
      dbUrl: '[REDACTED]',
      safe: ['x', { authorization: '[REDACTED]' }],
    });
  });

  it('returns explicit risk decisions with reasons', async () => {
    const provider = new StaticRiskDecisionProvider({ allowed: false, reason: 'tenant_suspended' });

    expect(await provider.decide({ tenant, action: 'orders:create' })).toEqual({
      allowed: false,
      reason: 'tenant_suspended',
    });
  });

  it('creates time-bound support grants and enforces expiry/action scope', () => {
    const now = new Date('2026-05-16T13:00:00.000Z');
    const grant = createSupportAccessGrant({
      tenant,
      supportUserId: 'support-1',
      reason: 'merchant requested debugging',
      allowedActions: ['config:read', 'orders:read'],
      expiresAt: new Date('2026-05-16T14:00:00.000Z'),
      createdAt: now,
    });

    expect(() => requireSupportAccess(grant, 'orders:read', now)).not.toThrow();
    expect(() => requireSupportAccess(grant, 'orders:create', now)).toThrow('Support grant does not allow action orders:create');
    expect(() => requireSupportAccess(grant, 'orders:read', new Date('2026-05-16T14:00:01.000Z'))).toThrow(
      'Support grant has expired'
    );
  });
});
