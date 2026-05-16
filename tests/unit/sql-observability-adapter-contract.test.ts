import { describe, expect, it } from 'vitest';
import {
  SqlCloudAuditTrail,
  SqlCloudUsageMeter,
  SqlQueryRecorder,
  createCloudAuditEvent,
} from '../../src/index.js';

const tenant = { organizationId: 'org-observe', tenantId: 'org-observe' };

describe('SQL observability adapter contracts', () => {
  it('records usage events with tenant scope and dedupe key', async () => {
    const db = new SqlQueryRecorder([]);
    const meter = new SqlCloudUsageMeter(db);

    await meter.recordUsage({ tenant, type: 'order.created', subjectId: 'order-1', quantity: 1, occurredAt: new Date('2026-05-16T22:00:00.000Z') });

    expect(db.queries[0]).toEqual({
      text: 'INSERT INTO usage_events (dedupe_key, organization_id, type, subject_id, quantity, occurred_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (dedupe_key) DO NOTHING',
      values: ['org-observe:order.created:order-1:2026-05', 'org-observe', 'order.created', 'order-1', 1, new Date('2026-05-16T22:00:00.000Z'), undefined],
    });
  });

  it('lists usage events by tenant and type', async () => {
    const db = new SqlQueryRecorder([{ dedupe_key: 'k1', organization_id: 'org-observe', type: 'order.created', subject_id: 'order-1', quantity: 1, occurred_at: new Date('2026-05-16T22:00:00.000Z') }]);
    const meter = new SqlCloudUsageMeter(db);

    await expect(meter.listUsage({ tenantId: 'org-observe', type: 'order.created' })).resolves.toMatchObject([
      { dedupeKey: 'k1', tenant: { organizationId: 'org-observe' }, type: 'order.created', subjectId: 'order-1' },
    ]);
    expect(db.queries[0]).toEqual({
      text: 'SELECT * FROM usage_events WHERE organization_id = $1 AND type = $2 ORDER BY occurred_at ASC',
      values: ['org-observe', 'order.created'],
    });
  });

  it('records audit events with redacted metadata', async () => {
    const db = new SqlQueryRecorder([]);
    const trail = new SqlCloudAuditTrail(db);

    await trail.record(createCloudAuditEvent({ tenant, action: 'api-keys:create', actor: { type: 'user', id: 'user-1' }, subjectId: 'key-1', metadata: { apiKey: 'secret' }, occurredAt: new Date('2026-05-16T22:01:00.000Z') }));

    expect(db.queries[0]).toEqual({
      text: 'INSERT INTO audit_events (organization_id, action, actor_type, actor_id, subject_id, occurred_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      values: ['org-observe', 'api-keys:create', 'user', 'user-1', 'key-1', new Date('2026-05-16T22:01:00.000Z'), { apiKey: '[REDACTED]' }],
    });
  });
});
