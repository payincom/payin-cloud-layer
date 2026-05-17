import { normalizeCloudOrder, type CloudOrder, type NormalizedCloudOrder } from '../../orders.js';
import { normalizeCloudPaymentLink, type CloudPaymentLink, type NormalizedCloudPaymentLink } from '../../payment-links.js';
import { normalizeCloudAddressPoolEntry, type CloudAddressPoolEntry, type NormalizedCloudAddressPoolEntry } from '../../address-pool.js';
import { normalizeCloudWebhookEndpoint, type CloudWebhookEndpoint, type CloudWebhookEndpointInput } from '../../webhooks.js';
import { normalizeCloudTenantContext, type CloudTenantContext } from '../../context.js';
import { createUsageDedupeKey, normalizeUsageEvent, type RequiredUsageEvent, type UsageMeter, type UsageQuery } from '../../usage-meter.js';
import type { CloudUsageEvent } from '../../hooks.js';
import type { CloudAuditTrail, CloudAuditTrailEvent, CloudAuditTrailQuery } from '../../audit-risk.js';
import type { CloudApiKey, CloudApiKeyCreateInput, CloudApiKeyLookupResult, CloudApiKeyManagementRepository } from '../../api-key.js';
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

export class SqlCloudUsageMeter implements UsageMeter {
  constructor(private readonly db: SqlQueryExecutor, private readonly tableName = 'usage_events') {
    rejectUnsafeSqlIdentifier(tableName);
  }

  async recordUsage(event: CloudUsageEvent): Promise<void> {
    const normalized = normalizeUsageEvent(event);
    await this.db.query(
      `INSERT INTO ${this.tableName} (dedupe_key, organization_id, type, subject_id, quantity, occurred_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (dedupe_key) DO NOTHING`,
      [normalized.dedupeKey, normalized.tenant.organizationId, normalized.type, normalized.subjectId, normalized.quantity, normalized.occurredAt, normalized.metadata]
    );
  }

  async listUsage(query: UsageQuery = {}): Promise<RequiredUsageEvent[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    let next = 1;
    if (query.tenantId) { clauses.push(`organization_id = $${next++}`); values.push(query.tenantId); }
    if (query.type) { clauses.push(`type = $${next++}`); values.push(query.type); }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.db.query<Record<string, unknown>>(`SELECT * FROM ${this.tableName}${where} ORDER BY occurred_at ASC`, values);
    return result.rows.map((row) => ({
      tenant: normalizeCloudTenantContext({ organizationId: String(row.organization_id) }),
      type: String(row.type) as CloudUsageEvent['type'],
      subjectId: row.subject_id ? String(row.subject_id) : undefined,
      quantity: Number(row.quantity ?? 1),
      occurredAt: new Date(String(row.occurred_at)),
      metadata: row.metadata as Record<string, unknown> | undefined,
      dedupeKey: String(row.dedupe_key ?? createUsageDedupeKey({ tenant: { organizationId: String(row.organization_id) }, type: String(row.type) as CloudUsageEvent['type'], subjectId: row.subject_id ? String(row.subject_id) : undefined, occurredAt: new Date(String(row.occurred_at)) })),
    }));
  }
}

export class SqlCloudAuditTrail implements CloudAuditTrail {
  constructor(private readonly db: SqlQueryExecutor, private readonly tableName = 'audit_events') {
    rejectUnsafeSqlIdentifier(tableName);
  }

  async record(event: CloudAuditTrailEvent): Promise<void> {
    await this.db.query(
      `INSERT INTO ${this.tableName} (organization_id, action, actor_type, actor_id, subject_id, occurred_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [event.tenant.organizationId, event.action, event.actor.type, event.actor.id, event.subjectId, event.occurredAt, event.metadata]
    );
  }

  async list(_query: CloudAuditTrailQuery = {}): Promise<CloudAuditTrailEvent[]> {
    throw new Error('SqlCloudAuditTrail.list is adapter-pending');
  }
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

export class SqlCloudApiKeyRepository implements CloudApiKeyManagementRepository {
  constructor(private readonly db: SqlQueryExecutor) {}

  async create(input: CloudApiKeyCreateInput): Promise<CloudApiKey> {
    const result = await this.db.query<Record<string, unknown>>(
      'INSERT INTO api_keys (id, key_hash, key_prefix, name, organization_id, user_id, role, capabilities, expires_at, created_at, metadata) VALUES ($1, crypt($2, gen_salt(\'bf\')), $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [
        input.apiKey.id,
        input.presentedKey,
        input.apiKey.keyPrefix,
        input.apiKey.name,
        input.apiKey.organizationId,
        input.apiKey.userId,
        input.apiKey.role,
        input.apiKey.capabilities,
        input.apiKey.expiresAt,
        input.apiKey.createdAt,
        input.apiKey.metadata,
      ]
    );
    return mapApiKeyRow(result.rows[0]);
  }

  async listForTenant(tenant: CloudTenantContext): Promise<CloudApiKey[]> {
    const result = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM api_keys WHERE organization_id = $1 ORDER BY created_at ASC',
      [tenant.organizationId]
    );
    return result.rows.map(mapApiKeyRow);
  }

  async revokeForTenant(apiKeyId: string, tenant: CloudTenantContext, revokedAt: Date): Promise<CloudApiKey> {
    const result = await this.db.query<Record<string, unknown>>(
      'UPDATE api_keys SET revoked_at = $1 WHERE id = $2 AND organization_id = $3 RETURNING *',
      [revokedAt, apiKeyId, tenant.organizationId]
    );
    if (!result.rows[0]) throw new Error(`API key not found: ${apiKeyId}`);
    return mapApiKeyRow(result.rows[0]);
  }

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

  async save(link: CloudPaymentLink): Promise<NormalizedCloudPaymentLink> {
    const normalized = normalizeCloudPaymentLink(link);
    const result = await this.db.query<Record<string, unknown>>(
      `INSERT INTO ${this.tableName} (id, organization_id, title, description, amount, currency, chain_options, status, slug, inventory_total, inventory_reserved) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        normalized.id,
        normalized.tenant.organizationId,
        normalized.title,
        normalized.description,
        normalized.amount,
        normalized.currency,
        normalized.chainOptions,
        normalized.status,
        normalized.slug,
        normalized.inventoryTotal,
        normalized.inventoryReserved,
      ]
    );
    return mapPaymentLinkRow(result.rows[0], normalized.tenant);
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

  async import(entries: CloudAddressPoolEntry[]): Promise<NormalizedCloudAddressPoolEntry[]> {
    const imported: NormalizedCloudAddressPoolEntry[] = [];
    for (const entry of entries.map(normalizeCloudAddressPoolEntry)) {
      const result = await this.db.query<Record<string, unknown>>(
        `INSERT INTO ${this.tableName} (address, organization_id, protocol, state, derivation_index, master_public_key_ref, deposit_reference, order_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          entry.address,
          entry.tenant.organizationId,
          entry.protocol,
          entry.state,
          entry.derivationIndex,
          entry.masterPublicKeyRef,
          entry.depositReference,
          entry.orderId,
        ]
      );
      imported.push(mapAddressPoolRow(result.rows[0], entry.tenant));
    }
    return imported;
  }

  async listByTenant(tenant: CloudTenantContext): Promise<NormalizedCloudAddressPoolEntry[]> {
    const tenantWhere = createSqlTenantWhereClause(tenant, 1);
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE ${tenantWhere.clause} ORDER BY created_at ASC`,
      tenantWhere.values
    );
    return result.rows.map((row) => mapAddressPoolRow(row, tenant));
  }

  async replace(entry: CloudAddressPoolEntry): Promise<NormalizedCloudAddressPoolEntry> {
    const normalized = normalizeCloudAddressPoolEntry(entry);
    const result = await this.db.query<Record<string, unknown>>(
      `UPDATE ${this.tableName} SET state = $1, deposit_reference = $2, order_id = $3 WHERE address = $4 AND organization_id = $5 RETURNING *`,
      [normalized.state, normalized.depositReference, normalized.orderId, normalized.address, normalized.tenant.organizationId]
    );
    return mapAddressPoolRow(result.rows[0], normalized.tenant);
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

function mapApiKeyRow(row: Record<string, unknown>): CloudApiKey {
  return {
    id: String(row.id),
    keyPrefix: String(row.key_prefix),
    name: String(row.name),
    organizationId: String(row.organization_id),
    userId: row.user_id ? String(row.user_id) : undefined,
    role: row.role ? String(row.role) as CloudOrganizationRole : undefined,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.map(String) as CloudApiKey['capabilities'] : undefined,
    expiresAt: row.expires_at ? new Date(String(row.expires_at)) : undefined,
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)) : undefined,
    lastUsedAt: row.last_used_at ? new Date(String(row.last_used_at)) : undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
  };
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
