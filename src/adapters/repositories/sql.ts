import { normalizeCloudOrder, type CloudOrder, type NormalizedCloudOrder } from '../../orders.js';
import type { CloudTenantContext } from '../../context.js';
import type { CloudOrderRepository } from './order-adapter.js';

export interface SqlQueryExecutor {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

export interface SqlTenantWhereClause {
  clause: string;
  values: string[];
  nextIndex: number;
}

export class SqlQueryRecorder implements SqlQueryExecutor {
  readonly queries: Array<{ text: string; values: unknown[] }> = [];

  constructor(private readonly rows: Record<string, unknown>[] = []) {}

  async query<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<{ rows: T[] }> {
    this.queries.push({ text, values });
    return { rows: this.rows as T[] };
  }
}

export function createSqlTenantWhereClause(tenant: CloudTenantContext, startIndex: number): SqlTenantWhereClause {
  return {
    clause: `organization_id = $${startIndex}`,
    values: [tenant.organizationId],
    nextIndex: startIndex + 1,
  };
}

export function rejectUnsafeSqlIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error('Unsafe SQL identifier');
  }
  return identifier;
}

export class SqlCloudOrderRepository implements CloudOrderRepository {
  private readonly tableName: string;

  constructor(
    private readonly db: SqlQueryExecutor,
    options: { tableName?: string } = {}
  ) {
    this.tableName = rejectUnsafeSqlIdentifier(options.tableName ?? 'orders');
  }

  async save(_order: CloudOrder): Promise<NormalizedCloudOrder> {
    throw new Error('SqlCloudOrderRepository.save is adapter-pending');
  }

  async findByTenant(orderId: string, tenant: CloudTenantContext): Promise<NormalizedCloudOrder | null> {
    const tenantWhere = createSqlTenantWhereClause(tenant, 2);
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND ${tenantWhere.clause} LIMIT 1`,
      [orderId, ...tenantWhere.values]
    );
    return result.rows[0] ? mapOrderRow(result.rows[0], tenant) : null;
  }

  async listByTenant(tenant: CloudTenantContext, filters: Record<string, unknown> = {}): Promise<NormalizedCloudOrder[]> {
    const tenantWhere = createSqlTenantWhereClause(tenant, 1);
    const clauses = [tenantWhere.clause];
    const values: unknown[] = [...tenantWhere.values];
    let nextIndex = tenantWhere.nextIndex;

    if (filters.status) {
      clauses.push(`status = $${nextIndex++}`);
      values.push(filters.status);
    }

    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
      values
    );
    return result.rows.map((row) => mapOrderRow(row, tenant));
  }
}

function mapOrderRow(row: Record<string, unknown>, tenant: CloudTenantContext): NormalizedCloudOrder {
  return normalizeCloudOrder({
    id: String(row.id),
    tenant,
    orderReference: String(row.order_reference ?? row.orderReference ?? row.id),
    amount: String(row.amount),
    currency: String(row.currency),
    chainId: String(row.chain_id ?? row.chainId),
    status: String(row.status) as CloudOrder['status'],
    paymentAddress: row.payment_address ? String(row.payment_address) : undefined,
    confirmedReceived: String(row.confirmed_received ?? row.confirmedReceived ?? '0'),
  });
}
