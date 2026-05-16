import { describe, expect, it } from 'vitest';
import {
  SqlCloudOrderRepository,
  SqlQueryRecorder,
  createSqlTenantWhereClause,
  rejectUnsafeSqlIdentifier,
} from '../../src/index.js';

const tenant = { organizationId: 'org-sql', tenantId: 'org-sql' };

describe('SQL adapter contract', () => {
  it('builds tenant where clauses with parameterized organization_id only', () => {
    expect(createSqlTenantWhereClause(tenant, 1)).toEqual({
      clause: 'organization_id = $1',
      values: ['org-sql'],
      nextIndex: 2,
    });
  });

  it('rejects unsafe SQL identifiers before adapter implementation', () => {
    expect(rejectUnsafeSqlIdentifier('orders')).toBe('orders');
    expect(rejectUnsafeSqlIdentifier('payment_links')).toBe('payment_links');
    expect(() => rejectUnsafeSqlIdentifier('orders; drop table users')).toThrow('Unsafe SQL identifier');
  });

  it('keeps order SQL repository tenant scoped and parameterized', async () => {
    const db = new SqlQueryRecorder([{ id: 'order-1', organization_id: 'org-sql', order_reference: 'ref-1', amount: '10.00', currency: 'USDC', chain_id: 'ethereum-sepolia', status: 'pending', confirmed_received: '0' }]);
    const repository = new SqlCloudOrderRepository(db, { tableName: 'orders' });

    await expect(repository.findByTenant('order-1', tenant)).resolves.toMatchObject({
      id: 'order-1',
      tenant,
      orderReference: 'ref-1',
      amount: '10.00',
    });

    expect(db.queries[0]).toEqual({
      text: 'SELECT * FROM orders WHERE id = $1 AND organization_id = $2 LIMIT 1',
      values: ['order-1', 'org-sql'],
    });
  });

  it('lists orders with tenant scope before optional filters', async () => {
    const db = new SqlQueryRecorder([]);
    const repository = new SqlCloudOrderRepository(db, { tableName: 'orders' });

    await repository.listByTenant(tenant, { status: 'pending' });

    expect(db.queries[0]).toEqual({
      text: 'SELECT * FROM orders WHERE organization_id = $1 AND status = $2 ORDER BY created_at DESC',
      values: ['org-sql', 'pending'],
    });
  });
});
