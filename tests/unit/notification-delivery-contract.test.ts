import { describe, expect, it } from 'vitest';
import {
  InMemoryCloudNotificationDeliveryRepository,
  createCloudWebhookDeliveryRecord,
  markCloudWebhookDeliveryFailed,
  markCloudWebhookDeliverySucceeded,
} from '../../src/index.js';

const tenant = { organizationId: 'org-notification', tenantId: 'org-notification' };

describe('notification delivery persistence contracts', () => {
  it('creates queued webhook delivery records with tenant scope', async () => {
    const repo = new InMemoryCloudNotificationDeliveryRepository();
    const record = createCloudWebhookDeliveryRecord({
      id: 'delivery-1',
      tenant,
      endpointId: 'wh-1',
      eventId: 'evt-1',
      eventType: 'order.completed',
      url: 'https://merchant.example/webhooks',
      headers: { 'payin-signature': 'sig' },
      body: '{}',
      createdAt: new Date('2026-05-17T01:35:00.000Z'),
    });

    await repo.enqueue(record);

    expect(await repo.listForTenant(tenant)).toMatchObject([
      { id: 'delivery-1', tenant, endpointId: 'wh-1', eventId: 'evt-1', status: 'queued', attemptCount: 0 },
    ]);
  });

  it('marks delivery success and failure attempts', () => {
    const base = createCloudWebhookDeliveryRecord({
      id: 'delivery-1', tenant, endpointId: 'wh-1', eventId: 'evt-1', eventType: 'order.completed', url: 'https://merchant.example/webhooks', headers: {}, body: '{}',
    });

    expect(markCloudWebhookDeliverySucceeded(base, { statusCode: 204, deliveredAt: new Date('2026-05-17T01:36:00.000Z') })).toMatchObject({
      status: 'succeeded', attemptCount: 1, lastStatusCode: 204, deliveredAt: new Date('2026-05-17T01:36:00.000Z'), nextAttemptAt: undefined,
    });
    expect(markCloudWebhookDeliveryFailed(base, { statusCode: 500, errorMessage: 'server error', failedAt: new Date('2026-05-17T01:37:00.000Z'), nextAttemptAt: new Date('2026-05-17T01:38:00.000Z') })).toMatchObject({
      status: 'retry_scheduled', attemptCount: 1, lastStatusCode: 500, errorMessage: 'server error', nextAttemptAt: new Date('2026-05-17T01:38:00.000Z'),
    });
  });

  it('claims due deliveries without crossing tenants', async () => {
    const repo = new InMemoryCloudNotificationDeliveryRepository();
    await repo.enqueue(createCloudWebhookDeliveryRecord({ id: 'due-1', tenant, endpointId: 'wh-1', eventId: 'evt-1', eventType: 'order.completed', url: 'https://merchant.example/webhooks', headers: {}, body: '{}', nextAttemptAt: new Date('2026-05-17T01:00:00.000Z') }));
    await repo.enqueue(createCloudWebhookDeliveryRecord({ id: 'later-1', tenant, endpointId: 'wh-1', eventId: 'evt-2', eventType: 'order.completed', url: 'https://merchant.example/webhooks', headers: {}, body: '{}', nextAttemptAt: new Date('2026-05-17T02:00:00.000Z') }));

    const due = await repo.claimDue({ now: new Date('2026-05-17T01:30:00.000Z'), limit: 10 });

    expect(due).toMatchObject([{ id: 'due-1', status: 'processing' }]);
    expect(await repo.listForTenant(tenant)).toMatchObject([
      { id: 'due-1', status: 'processing' },
      { id: 'later-1', status: 'queued' },
    ]);
  });
});
