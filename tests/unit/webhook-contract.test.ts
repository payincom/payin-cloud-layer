import { describe, expect, it, vi } from 'vitest';
import {
  CloudWebhookDeliveryError,
  CloudWebhookEndpointDisabledError,
  CloudWebhookSecretError,
  InMemoryCloudWebhookEndpointRepository,
  StaticCloudWebhookSigner,
  createCloudWebhookDelivery,
  filterWebhookEndpointsForEvent,
  normalizeCloudWebhookEndpoint,
  redactCloudWebhookEndpoint,
  type CloudWebhookEvent,
} from '../../src/index.js';

const tenant = { organizationId: 'org-webhook', tenantId: 'org-webhook' };
const event: CloudWebhookEvent = {
  id: 'evt-1',
  tenant,
  type: 'order.completed',
  subjectId: 'order-1',
  occurredAt: new Date('2026-05-16T12:50:00.000Z'),
  data: { orderId: 'order-1', amount: '10.00' },
};

describe('Cloud webhook/notification contract', () => {
  it('normalizes endpoint tenant context and requires secret refs instead of raw secrets', () => {
    expect(normalizeCloudWebhookEndpoint({
      id: 'wh-1',
      tenant: { organizationId: 'org-webhook' },
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://tenant/webhook-signing',
      enabled: true,
    })).toMatchObject({
      id: 'wh-1',
      tenant,
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://tenant/webhook-signing',
      enabled: true,
    });

    expect(() => normalizeCloudWebhookEndpoint({
      id: 'wh-raw',
      tenant,
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'whsec_raw_secret',
      enabled: true,
    })).toThrow(CloudWebhookSecretError);
  });

  it('redacts secret references from public endpoint views', () => {
    const endpoint = normalizeCloudWebhookEndpoint({
      id: 'wh-1',
      tenant,
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://tenant/webhook-signing',
      enabled: true,
    });

    expect(redactCloudWebhookEndpoint(endpoint)).toEqual({
      id: 'wh-1',
      tenant,
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      enabled: true,
      createdAt: undefined,
      updatedAt: undefined,
      metadata: undefined,
      signingSecretConfigured: true,
    });
  });

  it('filters endpoints by tenant, enabled status, and event type', () => {
    const endpoints = [
      normalizeCloudWebhookEndpoint({ id: 'wh-1', tenant, url: 'https://a.example', eventTypes: ['order.completed'], signingSecretRef: 'secret://a', enabled: true }),
      normalizeCloudWebhookEndpoint({ id: 'wh-2', tenant, url: 'https://b.example', eventTypes: ['payment_link.created'], signingSecretRef: 'secret://b', enabled: true }),
      normalizeCloudWebhookEndpoint({ id: 'wh-3', tenant, url: 'https://c.example', eventTypes: ['*'], signingSecretRef: 'secret://c', enabled: false }),
      normalizeCloudWebhookEndpoint({ id: 'wh-4', tenant: { organizationId: 'org-other' }, url: 'https://d.example', eventTypes: ['order.completed'], signingSecretRef: 'secret://d', enabled: true }),
    ];

    expect(filterWebhookEndpointsForEvent(endpoints, event).map((endpoint) => endpoint.id)).toEqual(['wh-1']);
  });

  it('builds signed delivery payloads without exposing raw secrets', async () => {
    const endpoint = normalizeCloudWebhookEndpoint({
      id: 'wh-1',
      tenant,
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://tenant/webhook-signing',
      enabled: true,
    });
    const signer = new StaticCloudWebhookSigner('test-signature');

    const delivery = await createCloudWebhookDelivery(endpoint, event, signer);

    expect(delivery).toMatchObject({
      endpointId: 'wh-1',
      tenant,
      url: 'https://merchant.example/webhook',
      event,
      headers: {
        'payin-event-id': 'evt-1',
        'payin-signature': 'test-signature',
      },
    });
    expect(JSON.stringify(delivery)).not.toContain('secret://tenant/webhook-signing');
  });

  it('rejects disabled endpoints before delivery creation', async () => {
    const endpoint = normalizeCloudWebhookEndpoint({
      id: 'wh-disabled',
      tenant,
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://tenant/webhook-signing',
      enabled: false,
    });

    await expect(createCloudWebhookDelivery(endpoint, event, new StaticCloudWebhookSigner('sig')))
      .rejects.toBeInstanceOf(CloudWebhookEndpointDisabledError);
  });

  it('keeps repository operations tenant scoped', async () => {
    const repository = new InMemoryCloudWebhookEndpointRepository([
      normalizeCloudWebhookEndpoint({ id: 'wh-1', tenant, url: 'https://a.example', eventTypes: ['order.completed'], signingSecretRef: 'secret://a', enabled: true }),
      normalizeCloudWebhookEndpoint({ id: 'wh-2', tenant: { organizationId: 'org-other' }, url: 'https://b.example', eventTypes: ['order.completed'], signingSecretRef: 'secret://b', enabled: true }),
    ]);

    expect(await repository.listForTenant(tenant)).toMatchObject([{ id: 'wh-1' }]);
    expect(await repository.getForTenant('wh-2', tenant)).toBeNull();
  });

  it('wraps signer failures as webhook delivery errors', async () => {
    const endpoint = normalizeCloudWebhookEndpoint({
      id: 'wh-1',
      tenant,
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://tenant/webhook-signing',
      enabled: true,
    });
    const signer = { sign: vi.fn(async () => { throw new Error('secret backend down'); }) };

    await expect(createCloudWebhookDelivery(endpoint, event, signer)).rejects.toBeInstanceOf(CloudWebhookDeliveryError);
  });
});
