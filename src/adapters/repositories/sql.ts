import { normalizeCloudOrder, type CloudOrder, type NormalizedCloudOrder } from '../../orders.js';
import { normalizeCloudPaymentLink, type CloudPaymentLink, type NormalizedCloudPaymentLink } from '../../payment-links.js';
import { normalizeCloudAddressPoolEntry, type CloudAddressPoolEntry, type NormalizedCloudAddressPoolEntry } from '../../address-pool.js';
import { normalizeCloudWebhookEndpoint, type CloudWebhookEndpoint, type CloudWebhookEndpointInput } from '../../webhooks.js';
import { normalizeCloudTenantContext, type CloudTenantContext } from '../../context.js';
import { normalizeHostedRuntimeConfig, type HostedConfigRepository, type HostedRuntimeConfig, type HostedRuntimeConfigInput } from '../../hosted-config.js';
import { createCloudWebhookDeliveryRecord, type CloudNotificationDeliveryRepository, type CloudWebhookDeliveryRecord } from '../../notification-delivery.js';
import { normalizeCloudSubscription, type CloudSubscription, type CloudSubscriptionInput, type CloudSubscriptionManagementRepository } from '../../subscription.js';
import { createUsageDedupeKey, normalizeUsageEvent, type RequiredUsageEvent, type UsageMeter, type UsageQuery } from '../../usage-meter.js';
import type { CloudUsageEvent } from '../../hooks.js';
import type { CloudAuditTrail, CloudAuditTrailEvent, CloudAuditTrailQuery } from '../../audit-risk.js';
import type { CloudApiKey, CloudApiKeyCreateInput, CloudApiKeyLookupResult, CloudApiKeyManagementRepository } from '../../api-key.js';
import type { CloudTenantMembership, CloudTenantResolver } from '../../tenant-resolver.js';
import type { CloudMemberAddDraft, CloudOrganization, CloudOrganizationMember, CloudOrganizationRepository, CloudOrganizationUpdateDraft, CloudMembershipStatus, CloudOrganizationRole, UpdateCloudMemberInput } from '../../organization.js';
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

export class SqlCloudSubscriptionRepository implements CloudSubscriptionManagementRepository {
  private readonly tableName: string;

  constructor(private readonly db: SqlQueryExecutor, options: { tableName?: string } = {}) {
    this.tableName = rejectUnsafeSqlIdentifier(options.tableName ?? 'subscriptions');
  }

  async getForTenant(tenant: CloudTenantContext): Promise<CloudSubscription | null> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE organization_id = $1 LIMIT 1`,
      [tenant.organizationId]
    );
    return result.rows[0] ? mapSubscriptionRow(result.rows[0]) : null;
  }

  async upsert(subscription: CloudSubscriptionInput): Promise<CloudSubscription> {
    const normalized = normalizeCloudSubscription(subscription);
    const updatedAt = new Date();
    const result = await this.db.query<Record<string, unknown>>(
      `INSERT INTO ${this.tableName} (organization_id, status, plan, billing_customer_ref, current_period_start, current_period_end, limits, metadata, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (organization_id) DO UPDATE SET status = EXCLUDED.status, plan = EXCLUDED.plan, billing_customer_ref = EXCLUDED.billing_customer_ref, current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end, limits = EXCLUDED.limits, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at RETURNING *`,
      [normalized.tenant.organizationId, normalized.status, normalized.plan, normalized.billingCustomerRef, normalized.currentPeriodStart, normalized.currentPeriodEnd, subscription.limits, normalized.metadata, updatedAt]
    );
    return mapSubscriptionRow(result.rows[0]);
  }
}

function mapSubscriptionRow(row: Record<string, unknown>): CloudSubscription {
  return normalizeCloudSubscription({
    tenant: { organizationId: String(row.organization_id) },
    status: String(row.status) as CloudSubscription['status'],
    plan: String(row.plan) as CloudSubscription['plan'],
    billingCustomerRef: row.billing_customer_ref ? String(row.billing_customer_ref) : undefined,
    currentPeriodStart: row.current_period_start ? new Date(String(row.current_period_start)) : undefined,
    currentPeriodEnd: row.current_period_end ? new Date(String(row.current_period_end)) : undefined,
    limits: row.limits as CloudSubscriptionInput['limits'],
    metadata: row.metadata as Record<string, unknown> | undefined,
  });
}

export class SqlCloudNotificationDeliveryRepository implements CloudNotificationDeliveryRepository {
  private readonly tableName: string;

  constructor(private readonly db: SqlQueryExecutor, options: { tableName?: string } = {}) {
    this.tableName = rejectUnsafeSqlIdentifier(options.tableName ?? 'notification_deliveries');
  }

  async enqueue(record: CloudWebhookDeliveryRecord): Promise<CloudWebhookDeliveryRecord> {
    const result = await this.db.query<Record<string, unknown>>(
      `INSERT INTO ${this.tableName} (id, organization_id, endpoint_id, event_id, event_type, url, headers, body, status, attempt_count, last_status_code, error_message, next_attempt_at, delivered_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [record.id, record.tenant.organizationId, record.endpointId, record.eventId, record.eventType, record.url, record.headers, record.body, record.status, record.attemptCount, record.lastStatusCode, record.errorMessage, record.nextAttemptAt, record.deliveredAt, record.createdAt, record.updatedAt]
    );
    return mapNotificationDeliveryRow(result.rows[0]);
  }

  async listForTenant(tenant: CloudTenantContext): Promise<CloudWebhookDeliveryRecord[]> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE organization_id = $1 ORDER BY created_at ASC`,
      [tenant.organizationId]
    );
    return result.rows.map(mapNotificationDeliveryRow);
  }

  async claimDue(input: { now: Date; limit: number }): Promise<CloudWebhookDeliveryRecord[]> {
    const result = await this.db.query<Record<string, unknown>>(
      `UPDATE ${this.tableName} SET status = 'processing', updated_at = $1 WHERE id IN (SELECT id FROM ${this.tableName} WHERE status IN ('queued', 'retry_scheduled') AND (next_attempt_at IS NULL OR next_attempt_at <= $1) ORDER BY COALESCE(next_attempt_at, created_at) ASC LIMIT $2 FOR UPDATE SKIP LOCKED) RETURNING *`,
      [input.now, input.limit]
    );
    return result.rows.map(mapNotificationDeliveryRow);
  }

  async replace(record: CloudWebhookDeliveryRecord): Promise<CloudWebhookDeliveryRecord> {
    const result = await this.db.query<Record<string, unknown>>(
      `UPDATE ${this.tableName} SET status = $1, attempt_count = $2, last_status_code = $3, error_message = $4, next_attempt_at = $5, delivered_at = $6, updated_at = $7 WHERE id = $8 AND organization_id = $9 RETURNING *`,
      [record.status, record.attemptCount, record.lastStatusCode, record.errorMessage, record.nextAttemptAt, record.deliveredAt, record.updatedAt, record.id, record.tenant.organizationId]
    );
    if (!result.rows[0]) throw new Error(`Notification delivery not found: ${record.id}`);
    return mapNotificationDeliveryRow(result.rows[0]);
  }
}

export class SqlHostedConfigRepository implements HostedConfigRepository {
  private readonly tableName: string;

  constructor(private readonly db: SqlQueryExecutor, private readonly options: { tableName?: string; defaults?: Omit<HostedRuntimeConfigInput, 'tenant'> } = {}) {
    this.tableName = rejectUnsafeSqlIdentifier(options.tableName ?? 'hosted_configs');
  }

  async getTenantConfig(tenant: CloudTenantContext): Promise<HostedRuntimeConfig> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE organization_id = $1 LIMIT 1`,
      [tenant.organizationId]
    );
    const row = result.rows[0];
    if (!row) return normalizeHostedRuntimeConfig({ ...(this.options.defaults ?? {}), tenant });
    return mapHostedConfigRow(row, tenant);
  }

  async updateTenantConfig(tenant: CloudTenantContext, updates: Partial<HostedRuntimeConfigInput>): Promise<HostedRuntimeConfig> {
    const updatedAt = new Date();
    const result = await this.db.query<Record<string, unknown>>(
      `INSERT INTO ${this.tableName} (organization_id, api_base_url, enabled_chains, enabled_tokens, secret_refs, limits, metadata, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (organization_id) DO UPDATE SET api_base_url = EXCLUDED.api_base_url, enabled_chains = EXCLUDED.enabled_chains, enabled_tokens = EXCLUDED.enabled_tokens, secret_refs = EXCLUDED.secret_refs, limits = EXCLUDED.limits, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at RETURNING *`,
      [tenant.organizationId, updates.apiBaseUrl, updates.enabledChains, updates.enabledTokens, updates.secretRefs, updates.limits, updates.metadata, updatedAt]
    );
    return mapHostedConfigRow(result.rows[0], tenant);
  }
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
    if (query.from) { clauses.push(`occurred_at >= $${next++}`); values.push(query.from); }
    if (query.to) { clauses.push(`occurred_at < $${next++}`); values.push(query.to); }
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

export class SqlCloudOrganizationRepository implements CloudOrganizationRepository {
  constructor(private readonly db: SqlQueryExecutor) {}

  async getByTenant(tenant: CloudTenantContext): Promise<CloudOrganization | null> {
    const result = await this.db.query<Record<string, unknown>>('SELECT * FROM organizations WHERE id = $1 LIMIT 1', [tenant.organizationId]);
    return result.rows[0] ? mapOrganizationRow(result.rows[0]) : null;
  }

  async updateByTenant(tenant: CloudTenantContext, updates: CloudOrganizationUpdateDraft): Promise<CloudOrganization> {
    const entries = Object.entries({
      name: updates.name,
      slug: updates.slug,
      avatar_url: updates.avatarUrl,
      website: updates.website,
      description: updates.description,
      plan_type: updates.planType,
      monthly_order_limit: updates.monthlyOrderLimit,
    }).filter(([, value]) => value !== undefined);
    if (!entries.length) {
      const existing = await this.getByTenant(tenant);
      if (!existing) throw new Error(`Organization not found: ${tenant.organizationId}`);
      return existing;
    }
    const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
    const values = entries.map(([, value]) => value);
    const result = await this.db.query<Record<string, unknown>>(
      `UPDATE organizations SET ${assignments.join(', ')} WHERE id = $${entries.length + 1} RETURNING *`,
      [...values, tenant.organizationId]
    );
    if (!result.rows[0]) throw new Error(`Organization not found: ${tenant.organizationId}`);
    return mapOrganizationRow(result.rows[0]);
  }

  async listMembers(tenant: CloudTenantContext): Promise<CloudOrganizationMember[]> {
    const result = await this.db.query<Record<string, unknown>>('SELECT * FROM organization_members WHERE organization_id = $1 ORDER BY created_at ASC', [tenant.organizationId]);
    return result.rows.map(mapOrganizationMemberRow);
  }

  async getMember(tenant: CloudTenantContext, userId: string): Promise<CloudOrganizationMember | null> {
    const result = await this.db.query<Record<string, unknown>>('SELECT * FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1', [tenant.organizationId, userId]);
    return result.rows[0] ? mapOrganizationMemberRow(result.rows[0]) : null;
  }

  async addMember(member: CloudMemberAddDraft): Promise<CloudOrganizationMember> {
    const result = await this.db.query<Record<string, unknown>>(
      'INSERT INTO organization_members (organization_id, user_id, role, status, invited_by, invited_at, joined_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [member.organizationId, member.userId, member.role, member.status, member.invitedBy, member.invitedAt, member.joinedAt]
    );
    return mapOrganizationMemberRow(result.rows[0]);
  }

  async updateMember(tenant: CloudTenantContext, userId: string, updates: UpdateCloudMemberInput): Promise<CloudOrganizationMember> {
    const result = await this.db.query<Record<string, unknown>>(
      'UPDATE organization_members SET role = $1, status = $2 WHERE organization_id = $3 AND user_id = $4 RETURNING *',
      [updates.role, updates.status, tenant.organizationId, userId]
    );
    if (!result.rows[0]) throw new Error(`Organization member not found: ${userId}`);
    return mapOrganizationMemberRow(result.rows[0]);
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
    const normalized = normalizeCloudPaymentLink({
      ...link,
      id: link.id || createSqlGeneratedId('plink'),
    });
    const result = await this.db.query<Record<string, unknown>>(
      `INSERT INTO ${this.tableName} (id, organization_id, title, description, amount, currency, chain_options, status, slug, inventory_total, inventory_reserved) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, amount = EXCLUDED.amount, currency = EXCLUDED.currency, chain_options = EXCLUDED.chain_options, status = EXCLUDED.status, slug = EXCLUDED.slug, inventory_total = EXCLUDED.inventory_total, inventory_reserved = EXCLUDED.inventory_reserved, updated_at = NOW() RETURNING *`,
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
    const normalized = normalizeCloudOrder({
      ...order,
      id: order.id || createSqlGeneratedId('order'),
    });
    const result = await this.db.query<Record<string, unknown>>(
      `INSERT INTO ${this.tableName} (id, organization_id, order_reference, amount, currency, chain_id, status, confirmed_received) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET order_reference = EXCLUDED.order_reference, amount = EXCLUDED.amount, currency = EXCLUDED.currency, chain_id = EXCLUDED.chain_id, status = EXCLUDED.status, confirmed_received = EXCLUDED.confirmed_received, updated_at = NOW() RETURNING *`,
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

function createSqlGeneratedId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

function mapNotificationDeliveryRow(row: Record<string, unknown>): CloudWebhookDeliveryRecord {
  return createCloudWebhookDeliveryRecord({
    id: String(row.id),
    tenant: { organizationId: String(row.organization_id) },
    endpointId: String(row.endpoint_id),
    eventId: String(row.event_id),
    eventType: String(row.event_type),
    url: String(row.url),
    headers: row.headers as Record<string, string>,
    body: String(row.body),
    status: String(row.status) as CloudWebhookDeliveryRecord['status'],
    attemptCount: Number(row.attempt_count ?? 0),
    lastStatusCode: row.last_status_code == null ? undefined : Number(row.last_status_code),
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    nextAttemptAt: row.next_attempt_at ? new Date(String(row.next_attempt_at)) : undefined,
    deliveredAt: row.delivered_at ? new Date(String(row.delivered_at)) : undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)) : undefined,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)) : undefined,
  });
}

function mapHostedConfigRow(row: Record<string, unknown>, tenant: CloudTenantContext): HostedRuntimeConfig {
  return normalizeHostedRuntimeConfig({
    tenant,
    apiBaseUrl: row.api_base_url ? String(row.api_base_url) : undefined,
    enabledChains: Array.isArray(row.enabled_chains) ? row.enabled_chains.map(String) : [],
    enabledTokens: Array.isArray(row.enabled_tokens) ? row.enabled_tokens.map(String) : [],
    secretRefs: row.secret_refs as HostedRuntimeConfigInput['secretRefs'],
    limits: row.limits as HostedRuntimeConfigInput['limits'],
    metadata: row.metadata as Record<string, unknown> | undefined,
  });
}

function mapOrganizationRow(row: Record<string, unknown>): CloudOrganization {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    planType: String(row.plan_type ?? row.planType ?? 'free') as CloudOrganization['planType'],
    avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
    website: row.website ? String(row.website) : undefined,
    description: row.description ? String(row.description) : undefined,
    monthlyOrderLimit: row.monthly_order_limit == null ? undefined : Number(row.monthly_order_limit),
    createdAt: row.created_at ? new Date(String(row.created_at)) : undefined,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)) : undefined,
  };
}

function mapOrganizationMemberRow(row: Record<string, unknown>): CloudOrganizationMember {
  return {
    id: row.id ? String(row.id) : undefined,
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    role: String(row.role) as CloudOrganizationRole,
    status: String(row.status) as CloudMembershipStatus,
    invitedBy: row.invited_by ? String(row.invited_by) : undefined,
    invitedAt: row.invited_at ? new Date(String(row.invited_at)) : undefined,
    joinedAt: row.joined_at ? new Date(String(row.joined_at)) : undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)) : undefined,
  };
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
