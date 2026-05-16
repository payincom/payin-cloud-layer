import { describe, expect, it } from 'vitest';
import {
  SqlCloudOrderRepository,
  SqlCloudWebhookRepository,
  SqlQueryRecorder,
  normalizeCloudOrder,
} from '../../src/index.js';

const tenant = { organizationId: 'org-sql-write', tenantId: 'org-sql-write' };

describe('SQL write adapter contracts', () => {
  it('saves orders with parameterized INSERT and maps returned rows', async () => {
    const returned = { id: 'order-1', organization_id: tenant.organizationId, order_reference: 'ref-1', amount: '10.00', currency: 'USDC', chain_id: 'ethereum-sepolia', status: 'pending', confirmed_received: '0' };
    const db = new SqlQueryRecorder([returned]);
    const repository = new SqlCloudOrderRepository(db);

    await expect(repository.save(normalizeCloudOrder({
      id: 'order-1',
      tenant,
      orderReference: 'ref-1',
      amount: '10.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      status: 'pending',
      confirmedReceived: '0',
    }))).resolves.toMatchObject({ id: 'order-1', tenant });

    expect(db.queries[0]).toEqual({
      text: 'INSERT INTO orders (id, organization_id, order_reference, amount, currency, chain_id, status, confirmed_received) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      values: ['order-1', tenant.organizationId, 'ref-1', '10.00', 'USDC', 'ethereum-sepolia', 'pending', '0'],
    });
  });

  it('upserts webhook endpoints with parameterized SQL and secret refs only', async () => {
    const returned = { id: 'wh-1', organization_id: tenant.organizationId, url: 'https://merchant.example/webhook', event_types: ['order.completed'], signing_secret_ref: 'secret://webhook', enabled: true };
    const db = new SqlQueryRecorder([returned]);
    const repository = new SqlCloudWebhookRepository(db);

    await expect(repository.upsert({
      id: 'wh-1',
      tenant,
      url: 'https://merchant.example/webhook',
      eventTypes: ['order.completed'],
      signingSecretRef: 'secret://webhook',
      enabled: true,
    })).resolves.toMatchObject({ id: 'wh-1', tenant });

    expect(db.queries[0]).toEqual({
      text: 'INSERT INTO webhook_endpoints (id, organization_id, url, event_types, signing_secret_ref, enabled) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, event_types = EXCLUDED.event_types, signing_secret_ref = EXCLUDED.signing_secret_ref, enabled = EXCLUDED.enabled RETURNING *',
      values: ['wh-1', tenant.organizationId, 'https://merchant.example/webhook', ['order.completed'], 'secret://webhook', true],
    });
  });
});
