import { describe, expect, it } from 'vitest';
import {
  InMemoryCloudNotificationDeliveryRepository,
  WebhookDeliveryWorker,
  createCloudWebhookDeliveryRecord,
} from '../../src/index.js';

const tenant = { organizationId: 'org-worker', tenantId: 'org-worker' };

function record(id = 'delivery-worker-1') {
  return createCloudWebhookDeliveryRecord({
    id,
    tenant,
    endpointId: 'wh-worker',
    eventId: 'evt-worker',
    eventType: 'order.completed',
    url: 'https://merchant.example/webhooks',
    headers: { 'payin-signature': 'sig-worker' },
    body: '{"ok":true}',
    nextAttemptAt: new Date('2026-05-17T02:20:00.000Z'),
    createdAt: new Date('2026-05-17T02:19:00.000Z'),
  });
}

describe('WebhookDeliveryWorker', () => {
  it('claims due deliveries, sends through transport, and marks success', async () => {
    const repo = new InMemoryCloudNotificationDeliveryRepository();
    await repo.enqueue(record());
    const sent: unknown[] = [];
    const worker = new WebhookDeliveryWorker({
      repository: repo,
      transport: { send: async (delivery) => { sent.push(delivery); return { statusCode: 204 }; } },
      now: () => new Date('2026-05-17T02:21:00.000Z'),
    });

    const result = await worker.processDue({ limit: 10 });

    expect(result).toEqual({ claimed: 1, succeeded: 1, failed: 0, retryScheduled: 0 });
    expect(sent).toMatchObject([{ id: 'delivery-worker-1', url: 'https://merchant.example/webhooks', body: '{"ok":true}' }]);
    expect(await repo.listForTenant(tenant)).toMatchObject([{ id: 'delivery-worker-1', status: 'succeeded', attemptCount: 1, lastStatusCode: 204 }]);
  });

  it('schedules retry for retryable delivery failures', async () => {
    const repo = new InMemoryCloudNotificationDeliveryRepository();
    await repo.enqueue(record());
    const worker = new WebhookDeliveryWorker({
      repository: repo,
      transport: { send: async () => ({ statusCode: 500, errorMessage: 'server error' }) },
      now: () => new Date('2026-05-17T02:21:00.000Z'),
      retry: { baseDelayMs: 1000, jitterRatio: 0, maxAttempts: 3 },
    });

    const result = await worker.processDue({ limit: 10 });

    expect(result).toEqual({ claimed: 1, succeeded: 0, failed: 0, retryScheduled: 1 });
    expect(await repo.listForTenant(tenant)).toMatchObject([
      { id: 'delivery-worker-1', status: 'retry_scheduled', attemptCount: 1, lastStatusCode: 500, errorMessage: 'server error', nextAttemptAt: new Date('2026-05-17T02:21:01.000Z') },
    ]);
  });

  it('marks delivery failed after max attempts or non-retryable status', async () => {
    const repo = new InMemoryCloudNotificationDeliveryRepository();
    await repo.enqueue(createCloudWebhookDeliveryRecord({ ...record(), attemptCount: 2 }));
    const worker = new WebhookDeliveryWorker({
      repository: repo,
      transport: { send: async () => ({ statusCode: 400, errorMessage: 'bad request' }) },
      now: () => new Date('2026-05-17T02:21:00.000Z'),
      retry: { maxAttempts: 3 },
    });

    const result = await worker.processDue({ limit: 10 });

    expect(result).toEqual({ claimed: 1, succeeded: 0, failed: 1, retryScheduled: 0 });
    expect(await repo.listForTenant(tenant)).toMatchObject([{ id: 'delivery-worker-1', status: 'failed', attemptCount: 3, lastStatusCode: 400 }]);
  });
});
