import { normalizeCloudOrder, type CloudOrder, type NormalizedCloudOrder } from '../../orders.js';
import { normalizeCloudTenantContext, type CloudTenantContext } from '../../context.js';
import type { CloudApiKeyLookupResult, CloudApiKeyRepository } from '../../api-key.js';
import type { CloudTenantMembership, CloudTenantResolver } from '../../tenant-resolver.js';
import type { CloudMembershipStatus, CloudOrganizationRole } from '../../organization.js';
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

export class SqlCloudTenantResolver implements CloudTenantResolver {
  constructor(private readonly db: SqlQueryExecutor) {}

  async resolveForUser(userId: string, organizationId: string): Promise<CloudTenantMembership | null> {
    const result = await this.db.query<Record<string, unknown>>(
      'SELECT om.user_id, om.organization_id, om.role, om.status, o.plan_type FROM organization_members om JOIN organizations o ON o.id = om.organization_id WHERE om.user_id = $1 AND om.organization_id = $2 LIMIT 1',
      [userId, organizationId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      userId: String(row.user_id),
      tenant: normalizeCloudTenantContext({ organizationId: String(row.organization_id), plan: String(row.plan_type) }),
      role: String(row.role) as CloudOrganizationRole,
      status: String(row.status) as CloudMembershipStatus,
    };
  }
}

export class SqlCloudApiKeyRepository implements CloudApiKeyRepository {
  constructor(private readonly db: SqlQueryExecutor) {}

  async findByPresentedKey(presentedKey: string): Promise<CloudApiKeyLookupResult> {
    const keyPrefix = presentedKey.slice(0, 8);
    const result = await this.db.query<Record<string, unknown>>(
      'SELECT ak.id, ak.key_prefix, ak.name, ak.organization_id, ak.user_id, ak.expires_at, ak.revoked_at, om.role, om.status, o.plan_type FROM api_keys ak JOIN organization_members om ON om.user_id = ak.user_id AND om.organization_id = ak.organization_id JOIN organizations o ON o.id = ak.organization_id WHERE ak.key_prefix = $1 LIMIT 1',
      [keyPrefix]
    );
    const row = result.rows[0];
    if (!row) return { apiKey: null };
    return {
      apiKey: {
        id: String(row.id),
        keyPrefix: String(row.key_prefix),
        name: String(row.name),
        organizationId: String(row.organization_id),
        userId: String(row.user_id),
        role: String(row.role) as CloudOrganizationRole,
        expiresAt: row.expires_at ? new Date(String(row.expires_at)) : undefined,
        revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : undefined,
      },
      membership: { role: String(row.role) as CloudOrganizationRole, status: String(row.status) as CloudMembershipStatus },
      tenant: normalizeCloudTenantContext({ organizationId: String(row.organization_id), plan: String(row.plan_type) }),
    };
  }
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
