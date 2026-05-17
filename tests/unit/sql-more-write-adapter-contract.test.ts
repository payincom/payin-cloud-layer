import { describe, expect, it } from 'vitest';
import {
  SqlCloudAddressPoolRepository,
  SqlCloudPaymentLinkRepository,
  SqlQueryRecorder,
  normalizeCloudAddressPoolEntry,
  normalizeCloudPaymentLink,
} from '../../src/index.js';

const tenant = { organizationId: 'org-sql-more-write', tenantId: 'org-sql-more-write' };

describe('SQL payment link/address pool write adapter contracts', () => {
  it('saves payment links with parameterized INSERT', async () => {
    const returned = { id: 'plink-1', organization_id: tenant.organizationId, title: 'Checkout', amount: '25.50', currency: 'USDC', chain_options: ['ethereum-sepolia'], status: 'draft', inventory_reserved: 0 };
    const db = new SqlQueryRecorder([returned]);
    const repository = new SqlCloudPaymentLinkRepository(db);

    await expect(repository.save(normalizeCloudPaymentLink({
      id: 'plink-1',
      tenant,
      title: 'Checkout',
      amount: '25.50',
      currency: 'USDC',
      chainOptions: ['ethereum-sepolia'],
      status: 'draft',
      inventoryReserved: 0,
    }))).resolves.toMatchObject({ id: 'plink-1', tenant });

    expect(db.queries[0]).toEqual({
      text: 'INSERT INTO paymentlinks (id, organization_id, title, description, amount, currency, chain_options, status, slug, inventory_total, inventory_reserved) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, amount = EXCLUDED.amount, currency = EXCLUDED.currency, chain_options = EXCLUDED.chain_options, status = EXCLUDED.status, slug = EXCLUDED.slug, inventory_total = EXCLUDED.inventory_total, inventory_reserved = EXCLUDED.inventory_reserved, updated_at = NOW() RETURNING *',
      values: ['plink-1', tenant.organizationId, 'Checkout', undefined, '25.50', 'USDC', ['ethereum-sepolia'], 'draft', undefined, undefined, 0],
    });
  });

  it('imports and replaces address pool rows with parameterized SQL', async () => {
    const returned = { address: '0x1', organization_id: tenant.organizationId, protocol: 'evm', state: 'idle', derivation_index: 0, master_public_key_ref: 'secret://xpub' };
    const db = new SqlQueryRecorder([returned]);
    const repository = new SqlCloudAddressPoolRepository(db);

    await expect(repository.import([normalizeCloudAddressPoolEntry({
      tenant,
      address: '0x1',
      protocol: 'evm',
      state: 'idle',
      derivationIndex: 0,
      masterPublicKeyRef: 'secret://xpub',
    })])).resolves.toMatchObject([{ address: '0x1', tenant }]);

    expect(db.queries[0]).toEqual({
      text: 'INSERT INTO address_pool (address, organization_id, protocol, state, derivation_index, master_public_key_ref, deposit_reference, order_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      values: ['0x1', tenant.organizationId, 'evm', 'idle', 0, 'secret://xpub', undefined, undefined],
    });

    await repository.replace(normalizeCloudAddressPoolEntry({ tenant, address: '0x1', protocol: 'evm', state: 'bound', depositReference: 'dep-1', orderId: 'order-1' }));
    expect(db.queries[1]).toEqual({
      text: 'UPDATE address_pool SET state = $1, deposit_reference = $2, order_id = $3 WHERE address = $4 AND organization_id = $5 RETURNING *',
      values: ['bound', 'dep-1', 'order-1', '0x1', tenant.organizationId],
    });
  });
});
