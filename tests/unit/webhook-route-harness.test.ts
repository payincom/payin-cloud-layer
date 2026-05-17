import { describe, expect, it } from 'vitest';
import { createCloudWebhookRouteHandlers, type CloudWebhookService } from '../../src/index.js';

describe('Cloud webhook route harness', () => {
  it('maps endpoint upsert input to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudWebhookRouteHandlers({
      webhooks: {
        async upsertEndpoint(input: unknown) {
          calls.push(input);
          return { id: 'wh-route', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, url: 'https://merchant.example/webhooks', eventTypes: ['order.created'], signingSecretRef: 'secret://webhooks/route', enabled: true };
        },
        async createTestDelivery() { throw new Error('unused'); },
        async listEndpoints() { throw new Error('unused'); },
        async deleteEndpoint() { throw new Error('unused'); },
        async listDeliveries() { throw new Error('unused'); },
        async replayDelivery() { throw new Error('unused'); },
      } as Pick<CloudWebhookService, 'upsertEndpoint' | 'createTestDelivery' | 'listEndpoints' | 'deleteEndpoint' | 'listDeliveries' | 'replayDelivery'>,
    });

    await expect(handlers.upsertEndpoint({
      headers: { authorization: 'Bearer pk_live_route' },
      params: { endpointId: 'wh-route' },
      body: { url: 'https://merchant.example/webhooks', eventTypes: ['order.created'], signingSecretRef: 'secret://webhooks/route', enabled: true },
    })).resolves.toEqual({ status: 200, body: { data: { id: 'wh-route', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, url: 'https://merchant.example/webhooks', eventTypes: ['order.created'], signingSecretRef: 'secret://webhooks/route', enabled: true } } });

    expect(calls).toEqual([{ apiKey: 'pk_live_route', id: 'wh-route', url: 'https://merchant.example/webhooks', eventTypes: ['order.created'], signingSecretRef: 'secret://webhooks/route', enabled: true }]);
  });

  it('maps webhook test delivery input to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudWebhookRouteHandlers({
      webhooks: {
        async upsertEndpoint() { throw new Error('unused'); },
        async listEndpoints() { throw new Error('unused'); },
        async deleteEndpoint() { throw new Error('unused'); },
        async listDeliveries() { throw new Error('unused'); },
        async replayDelivery() { throw new Error('unused'); },
        async createTestDelivery(input: unknown) {
          calls.push(input);
          return { endpointId: 'wh-route', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, url: 'https://merchant.example/webhooks', headers: { 'payin-signature': 'sig' }, body: '{}', event: { id: 'evt-route', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, type: 'webhook.tested', occurredAt: new Date('2026-05-16T23:40:00.000Z'), data: {} } };
        },
      } as Pick<CloudWebhookService, 'upsertEndpoint' | 'createTestDelivery' | 'listEndpoints' | 'deleteEndpoint' | 'listDeliveries' | 'replayDelivery'>,
    });

    await expect(handlers.createTestDelivery({
      headers: { authorization: 'Bearer pk_live_route' },
      params: { endpointId: 'wh-route' },
      body: { eventId: 'evt-route' },
    })).resolves.toEqual({ status: 200, body: { data: { endpointId: 'wh-route', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, url: 'https://merchant.example/webhooks', headers: { 'payin-signature': 'sig' }, body: '{}', event: { id: 'evt-route', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, type: 'webhook.tested', occurredAt: new Date('2026-05-16T23:40:00.000Z'), data: {} } } } });

    expect(calls).toEqual([{ apiKey: 'pk_live_route', endpointId: 'wh-route', eventId: 'evt-route' }]);
  });

  it('maps endpoint list and delete operations to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudWebhookRouteHandlers({
      webhooks: {
        async upsertEndpoint() { throw new Error('unused'); },
        async createTestDelivery() { throw new Error('unused'); },
        async listEndpoints(input: unknown) { calls.push(['list', input]); return [{ id: 'wh-route' }]; },
        async deleteEndpoint(input: unknown) { calls.push(['delete', input]); return { id: 'wh-route', deleted: true }; },
      } as never,
    });

    await expect(handlers.listEndpoints({ headers: { authorization: 'Bearer pk_live_route' }, params: {}, body: undefined })).resolves.toEqual({ status: 200, body: { data: [{ id: 'wh-route' }] } });
    await expect(handlers.deleteEndpoint({ headers: { authorization: 'Bearer pk_live_route' }, params: { endpointId: 'wh-route' }, body: undefined })).resolves.toEqual({ status: 204, body: {} });
    expect(calls).toEqual([
      ['list', { apiKey: 'pk_live_route' }],
      ['delete', { apiKey: 'pk_live_route', endpointId: 'wh-route' }],
    ]);
  });

  it('maps delivery list and replay operations to service', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudWebhookRouteHandlers({
      webhooks: {
        async upsertEndpoint() { throw new Error('unused'); },
        async createTestDelivery() { throw new Error('unused'); },
        async listEndpoints() { throw new Error('unused'); },
        async deleteEndpoint() { throw new Error('unused'); },
        async listDeliveries(input: unknown) { calls.push(['listDeliveries', input]); return [{ id: 'delivery-route', endpointId: 'wh-route', status: 'queued' }]; },
        async replayDelivery(input: unknown) { calls.push(['replayDelivery', input]); return { id: 'delivery-route', status: 'queued' }; },
      } as never,
    });

    await expect(handlers.listDeliveries({ headers: { authorization: 'Bearer pk_live_route' }, query: { endpointId: 'wh-route', status: 'queued' }, body: undefined })).resolves.toEqual({ status: 200, body: { data: [{ id: 'delivery-route', endpointId: 'wh-route', status: 'queued' }] } });
    await expect(handlers.replayDelivery({ headers: { authorization: 'Bearer pk_live_route' }, params: { deliveryId: 'delivery-route' }, body: undefined })).resolves.toEqual({ status: 200, body: { data: { id: 'delivery-route', status: 'queued' } } });
    expect(calls).toEqual([
      ['listDeliveries', { apiKey: 'pk_live_route', endpointId: 'wh-route', status: 'queued' }],
      ['replayDelivery', { apiKey: 'pk_live_route', deliveryId: 'delivery-route' }],
    ]);
  });
});
