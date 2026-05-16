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
      } as Pick<CloudWebhookService, 'upsertEndpoint' | 'createTestDelivery'>,
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
        async createTestDelivery(input: unknown) {
          calls.push(input);
          return { endpointId: 'wh-route', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, url: 'https://merchant.example/webhooks', headers: { 'payin-signature': 'sig' }, body: '{}', event: { id: 'evt-route', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, type: 'webhook.tested', occurredAt: new Date('2026-05-16T23:40:00.000Z'), data: {} } };
        },
      } as Pick<CloudWebhookService, 'upsertEndpoint' | 'createTestDelivery'>,
    });

    await expect(handlers.createTestDelivery({
      headers: { authorization: 'Bearer pk_live_route' },
      params: { endpointId: 'wh-route' },
      body: { eventId: 'evt-route' },
    })).resolves.toEqual({ status: 200, body: { data: { endpointId: 'wh-route', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, url: 'https://merchant.example/webhooks', headers: { 'payin-signature': 'sig' }, body: '{}', event: { id: 'evt-route', tenant: { organizationId: 'org-route', tenantId: 'org-route' }, type: 'webhook.tested', occurredAt: new Date('2026-05-16T23:40:00.000Z'), data: {} } } } });

    expect(calls).toEqual([{ apiKey: 'pk_live_route', endpointId: 'wh-route', eventId: 'evt-route' }]);
  });
});
