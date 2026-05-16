import { describe, expect, it } from 'vitest';
import {
  SqlCloudAddressPoolRepository,
  SqlCloudPaymentLinkRepository,
  SqlCloudWebhookRepository,
  SqlQueryRecorder,
} from '../../src/index.js';

const tenant = { organizationId: 'org-sql-business', tenantId: 'org-sql-business' };

describe('SQL business adapter contracts', () => {
  it('loads payment links with tenant scope and parameterized filters', async () => {
    const db = new SqlQueryRecorder([{ id: 'plink-1', organization_id: tenant.organizationId, title: 'Checkout', amount: '25.50', currency: 'USDC', chain_options: ['ethereum-sepolia'], status: 'draft', inventory_reserved: 0 }]);
    const repository = new SqlCloudPaymentLinkRepository(db);

    await expect(repository.findByTenant('plink-1', tenant)).resolves.toMatchObject({ id: 'plink-1', tenant, title: 'Checkout' });
    await repository.listByTenant(tenant, { status: 'draft' });

    expect(db.queries[0]).toEqual({
      text: 'SELECT * FROM paymentlinks WHERE id = $1 AND organization_id = $2 LIMIT 1',
      values: ['plink-1', tenant.organizationId],
    });
    expect(db.queries[1]).toEqual({
      text: 'SELECT * FROM paymentlinks WHERE organization_id = $1 AND status = $2 ORDER BY created_at DESC',
      values: [tenant.organizationId, 'draft'],
    });
  });

  it('loads address pool entries with tenant scope', async () => {
    const db = new SqlQueryRecorder([{ address: '0x1', organization_id: tenant.organizationId, protocol: 'evm', state: 'idle', derivation_index: 0, master_public_key_ref: 'secret://xpub' }]);
    const repository = new SqlCloudAddressPoolRepository(db);

    await expect(repository.listByTenant(tenant)).resolves.toMatchObject([{ address: '0x1', tenant, protocol: 'evm', state: 'idle' }]);
    expect(db.queries[0]).toEqual({
      text: 'SELECT * FROM address_pool WHERE organization_id = $1 ORDER BY created_at ASC',
      values: [tenant.organizationId],
    });
  });

  it('loads webhook endpoints with tenant scope', async () => {
    const db = new SqlQueryRecorder([{ id: 'wh-1', organization_id: tenant.organizationId, url: 'https://merchant.example/webhook', event_types: ['order.completed'], signing_secret_ref: 'secret://webhook', enabled: true }]);
    const repository = new SqlCloudWebhookRepository(db);

    await expect(repository.getForTenant('wh-1', tenant)).resolves.toMatchObject({ id: 'wh-1', tenant });
    await repository.listForTenant(tenant);

    expect(db.queries[0]).toEqual({
      text: 'SELECT * FROM webhook_endpoints WHERE id = $1 AND organization_id = $2 LIMIT 1',
      values: ['wh-1', tenant.organizationId],
    });
    expect(db.queries[1]).toEqual({
      text: 'SELECT * FROM webhook_endpoints WHERE organization_id = $1 ORDER BY created_at DESC',
      values: [tenant.organizationId],
    });
  });
});
