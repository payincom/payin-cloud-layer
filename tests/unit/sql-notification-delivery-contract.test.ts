import { describe, expect, it } from 'vitest';
import { SqlCloudNotificationDeliveryRepository, SqlQueryRecorder, createCloudWebhookDeliveryRecord } from '../../src/index.js';

const tenant = { organizationId: 'org-sql-delivery', tenantId: 'org-sql-delivery' };

describe('SQL notification delivery repository contracts', () => {
  it('enqueues delivery records', async () => {
    const db = new SqlQueryRecorder([{ id: 'delivery-sql', organization_id: tenant.organizationId, endpoint_id: 'wh-1', event_id: 'evt-1', event_type: 'order.completed', url: 'https://merchant.example/webhooks', headers: {}, body: '{}', status: 'queued', attempt_count: 0 }]);
    const repo = new SqlCloudNotificationDeliveryRepository(db);
    const record = createCloudWebhookDeliveryRecord({ id: 'delivery-sql', tenant, endpointId: 'wh-1', eventId: 'evt-1', eventType: 'order.completed', url: 'https://merchant.example/webhooks', headers: {}, body: '{}' });

    await expect(repo.enqueue(record)).resolves.toMatchObject({ id: 'delivery-sql', status: 'queued', tenant });
    expect(db.queries[0]).toEqual({
      text: 'INSERT INTO notification_deliveries (id, organization_id, endpoint_id, event_id, event_type, url, headers, body, status, attempt_count, last_status_code, error_message, next_attempt_at, delivered_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *',
      values: ['delivery-sql', tenant.organizationId, 'wh-1', 'evt-1', 'order.completed', 'https://merchant.example/webhooks', {}, '{}', 'queued', 0, undefined, undefined, undefined, undefined, record.createdAt, record.updatedAt],
    });
  });

  it('lists tenant deliveries', async () => {
    const db = new SqlQueryRecorder([{ id: 'delivery-sql', organization_id: tenant.organizationId, endpoint_id: 'wh-1', event_id: 'evt-1', event_type: 'order.completed', url: 'https://merchant.example/webhooks', headers: {}, body: '{}', status: 'queued', attempt_count: 0 }]);
    const repo = new SqlCloudNotificationDeliveryRepository(db);

    await expect(repo.listForTenant(tenant)).resolves.toMatchObject([{ id: 'delivery-sql', tenant }]);
    expect(db.queries[0]).toEqual({
      text: 'SELECT * FROM notification_deliveries WHERE organization_id = $1 ORDER BY created_at ASC',
      values: [tenant.organizationId],
    });
  });

  it('claims due deliveries', async () => {
    const now = new Date('2026-05-17T01:45:00.000Z');
    const db = new SqlQueryRecorder([{ id: 'delivery-sql', organization_id: tenant.organizationId, endpoint_id: 'wh-1', event_id: 'evt-1', event_type: 'order.completed', url: 'https://merchant.example/webhooks', headers: {}, body: '{}', status: 'processing', attempt_count: 0 }]);
    const repo = new SqlCloudNotificationDeliveryRepository(db);

    await expect(repo.claimDue({ now, limit: 5 })).resolves.toMatchObject([{ id: 'delivery-sql', status: 'processing' }]);
    expect(db.queries[0]).toEqual({
      text: "UPDATE notification_deliveries SET status = 'processing', updated_at = $1 WHERE id IN (SELECT id FROM notification_deliveries WHERE status IN ('queued', 'retry_scheduled') AND (next_attempt_at IS NULL OR next_attempt_at <= $1) ORDER BY COALESCE(next_attempt_at, created_at) ASC LIMIT $2 FOR UPDATE SKIP LOCKED) RETURNING *",
      values: [now, 5],
    });
  });
});
