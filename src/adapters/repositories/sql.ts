import { normalizeCloudOrder, type CloudOrder, type NormalizedCloudOrder } from '../../orders.js';
import { normalizeCloudPaymentLink, type CloudPaymentLink, type NormalizedCloudPaymentLink } from '../../payment-links.js';
import { normalizeCloudAddressPoolEntry, type CloudAddressPoolEntry, type NormalizedCloudAddressPoolEntry } from '../../address-pool.js';
import { normalizeCloudWebhookEndpoint, type CloudWebhookEndpoint, type CloudWebhookEndpointInput } from '../../webhooks.js';
import { normalizeCloudTenantContext, type CloudTenantContext } from '../../context.js';
import type { CloudApiKeyLookupResult, CloudApiKeyRepository } from '../../api-key.js';
import type { CloudTenantMembership, CloudTenantResolver } from '../../tenant-resolver.js';
import type { CloudMembershipStatus, CloudOrganizationRole } from '../../organization.js';
import type { CloudOrderRepository } from './order-adapter.js';
import type { CloudPaymentLinkRepository } from './payment-link-adapter.js';
import type { CloudAddressPoolRepository } from './address-pool-adapter.js';
import type { MutableCloudWebhookEndpointRepository } from './webhook-adapter.js';

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

export class SqlCloudPaymentLinkRepository implements CloudPaymentLinkRepository {
  private readonly tableName: string;

  constructor(private readonly db: SqlQueryExecutor, options: { tableName?: string } = {}) {
    this.tableName = rejectUnsafeSqlIdentifier(options.tableName ?? 'paymentlinks');
  }

  async save(_link: CloudPaymentLink): Promise<NormalizedCloudPaymentLink> {
    throw new Error('SqlCloudPaymentLinkRepository.save is adapter-pending');
  }

  async findByTenant(paymentLinkId: string, tenant: CloudTenantContext): Promise<NormalizedCloudPaymentLink | null> {
    const tenantWhere = createSqlTenantWhereClause(tenant, 2);
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND ${tenantWhere.clause} LIMIT 1`,
      [paymentLinkId, ...tenantWhere.values]
    );
    return result.rows[0] ? mapPaymentLinkRow(result.rows[0], tenant) : null;
  }

  async listByTenant(tenant: CloudTenantContext, filters: Record<string, unknown> = {}): Promise<NormalizedCloudPaymentLink[]> {
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
    return result.rows.map((row) => mapPaymentLinkRow(row, tenant));
  }
}

export class SqlCloudAddressPoolRepository implements CloudAddressPoolRepository {
  private readonly tableName: string;

  constructor(private readonly db: SqlQueryExecutor, options: { tableName?: string } = {}) {
    this.tableName = rejectUnsafeSqlIdentifier(options.tableName ?? 'address_pool');
  }

  async import(_entries: CloudAddressPoolEntry[]): Promise<NormalizedCloudAddressPoolEntry[]> {
    throw new Error('SqlCloudAddressPoolRepository.import is adapter-pending');
  }

  async listByTenant(tenant: CloudTenantContext): Promise<NormalizedCloudAddressPoolEntry[]> {
    const tenantWhere = createSqlTenantWhereClause(tenant, 1);
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE ${tenantWhere.clause} ORDER BY created_at ASC`,
      tenantWhere.values
    );
    return result.rows.map((row) => mapAddressPoolRow(row, tenant));
  }

  async replace(_entry: CloudAddressPoolEntry): Promise<NormalizedCloudAddressPoolEntry> {
    throw new Error('SqlCloudAddressPoolRepository.replace is adapter-pending');
  }
}

export class SqlCloudWebhookRepository implements MutableCloudWebhookEndpointRepository {
  private readonly tableName: string;

  constructor(private readonly db: SqlQueryExecutor, options: { tableName?: string } = {}) {
    this.tableName = rejectUnsafeSqlIdentifier(options.tableName ?? 'webhook_endpoints');
  }

  async upsert(input: CloudWebhookEndpointInput): Promise<CloudWebhookEndpoint> {
    const endpoint = normalizeCloudWebhookEndpoint(input);
    const result = await this.db.query<Record<string, unknown>>(
      `INSERT INTO ${this.tableName} (id, organization_id, url, event_types, signing_secret_ref, enabled) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, event_types = EXCLUDED.event_types, signing_secret_ref = EXCLUDED.signing_secret_ref, enabled = EXCLUDED.enabled RETURNING *`,
      [endpoint.id, endpoint.tenant.organizationId, endpoint.url, endpoint.eventTypes, endpoint.signingSecretRef, endpoint.enabled]
    );
    return mapWebhookRow(result.rows[0], endpoint.tenant);
  }

  async listForTenant(tenant: CloudTenantContext): Promise<CloudWebhookEndpoint[]> {
    const tenantWhere = createSqlTenantWhereClause(tenant, 1);
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE ${tenantWhere.clause} ORDER BY created_at DESC`,
      tenantWhere.values
    );
    return result.rows.map((row) => mapWebhookRow(row, tenant));
  }

  async getForTenant(endpointId: string, tenant: CloudTenantContext): Promise<CloudWebhookEndpoint | null> {
    const tenantWhere = createSqlTenantWhereClause(tenant, 2);
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND ${tenantWhere.clause} LIMIT 1`,
      [endpointId, ...tenantWhere.values]
    );
    return result.rows[0] ? mapWebhookRow(result.rows[0], tenant) : null;
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

  async save(order: CloudOrder): Promise<NormalizedCloudOrder> {
    const normalized = normalizeCloudOrder(order);
    const result = await this.db.query<Record<string, unknown>>(
      `INSERT INTO ${this.tableName} (id, organization_id, order_reference, amount, currency, chain_id, status, confirmed_received) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        normalized.id,
        normalized.tenant.organizationId,
        normalized.orderReference,
        normalized.amount,
        normalized.currency,
        normalized.chainId,
        normalized.status,
        normalized.confirmedReceived,
      ]
    );
    return mapOrderRow(result.rows[0], normalized.tenant);
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

function mapPaymentLinkRow(row: Record<string, unknown>, tenant: CloudTenantContext): NormalizedCloudPaymentLink {
  return normalizeCloudPaymentLink({
    id: String(row.id),
    tenant,
    title: String(row.title),
    description: row.description ? String(row.description) : undefined,
    amount: String(row.amount),
    currency: String(row.currency),
    chainOptions: Array.isArray(row.chain_options) ? row.chain_options.map(String) : String(row.chain_options ?? '').split(',').filter(Boolean),
    status: String(row.status) as CloudPaymentLink['status'],
    slug: row.slug ? String(row.slug) : undefined,
    inventoryTotal: row.inventory_total == null ? undefined : Number(row.inventory_total),
    inventoryReserved: row.inventory_reserved == null ? 0 : Number(row.inventory_reserved),
  });
}

function mapAddressPoolRow(row: Record<string, unknown>, tenant: CloudTenantContext): NormalizedCloudAddressPoolEntry {
  return normalizeCloudAddressPoolEntry({
    tenant,
    address: String(row.address),
    protocol: String(row.protocol),
    state: String(row.state ?? 'idle') as CloudAddressPoolEntry['state'],
    derivationIndex: row.derivation_index == null ? undefined : Number(row.derivation_index),
    masterPublicKeyRef: row.master_public_key_ref ? String(row.master_public_key_ref) : undefined,
    depositReference: row.deposit_reference ? String(row.deposit_reference) : undefined,
    orderId: row.order_id ? String(row.order_id) : undefined,
  });
}

function mapWebhookRow(row: Record<string, unknown>, tenant: CloudTenantContext): CloudWebhookEndpoint {
  return normalizeCloudWebhookEndpoint({
    id: String(row.id),
    tenant,
    url: String(row.url),
    eventTypes: Array.isArray(row.event_types) ? row.event_types.map(String) : String(row.event_types ?? '').split(',').filter(Boolean),
    signingSecretRef: String(row.signing_secret_ref),
    enabled: Boolean(row.enabled),
  });
}
