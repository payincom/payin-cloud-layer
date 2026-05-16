import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';
import type { CloudCapability } from './entitlements.js';

export type CloudAuditActorType = 'user' | 'api_key' | 'support' | 'system';

export interface CloudAuditActor {
  type: CloudAuditActorType;
  id: string;
}

export interface CloudAuditTrailEvent {
  id?: string;
  tenant: NormalizedCloudTenantContext;
  action: CloudCapability;
  actor: CloudAuditActor;
  subjectId?: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}

export interface CloudAuditTrailQuery {
  tenantId?: string;
  action?: CloudCapability;
  actorId?: string;
}

export interface CloudAuditTrail {
  record(event: CloudAuditTrailEvent): Promise<void> | void;
  list(query?: CloudAuditTrailQuery): Promise<CloudAuditTrailEvent[]> | CloudAuditTrailEvent[];
}

export interface CloudRiskDecisionInput {
  tenant: CloudTenantContext;
  action: CloudCapability;
  actor?: CloudAuditActor;
  metadata?: Record<string, unknown>;
}

export interface CloudRiskDecision {
  allowed: boolean;
  reason?: string;
}

export interface CloudRiskDecisionProvider {
  decide(input: CloudRiskDecisionInput): Promise<CloudRiskDecision> | CloudRiskDecision;
}

export interface SupportAccessGrantInput {
  tenant: CloudTenantContext;
  supportUserId: string;
  reason: string;
  allowedActions: CloudCapability[];
  expiresAt: Date;
  createdAt?: Date;
}

export interface SupportAccessGrant extends Omit<SupportAccessGrantInput, 'tenant' | 'createdAt'> {
  tenant: NormalizedCloudTenantContext;
  createdAt: Date;
}

export class SupportAccessError extends Error {
  readonly code = 'SUPPORT_ACCESS_DENIED';

  constructor(message: string) {
    super(message);
    this.name = 'SupportAccessError';
  }
}

export function createCloudAuditEvent(input: {
  tenant: CloudTenantContext;
  action: CloudCapability;
  actor: CloudAuditActor;
  subjectId?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}): CloudAuditTrailEvent {
  return {
    tenant: normalizeCloudTenantContext(input.tenant),
    action: input.action,
    actor: input.actor,
    subjectId: input.subjectId,
    metadata: input.metadata ? redactCloudAuditMetadata(input.metadata) : undefined,
    occurredAt: input.occurredAt ?? new Date(),
  };
}

export function redactCloudAuditMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return redactObject(value) as Record<string, unknown>;
}

export class InMemoryCloudAuditTrail implements CloudAuditTrail {
  private readonly events: CloudAuditTrailEvent[] = [];

  record(event: CloudAuditTrailEvent): void {
    this.events.push(event);
  }

  list(query: CloudAuditTrailQuery = {}): CloudAuditTrailEvent[] {
    return this.events.filter((event) => {
      if (query.tenantId && event.tenant.organizationId !== query.tenantId && event.tenant.tenantId !== query.tenantId) return false;
      if (query.action && event.action !== query.action) return false;
      if (query.actorId && event.actor.id !== query.actorId) return false;
      return true;
    });
  }
}

export class StaticRiskDecisionProvider implements CloudRiskDecisionProvider {
  constructor(private readonly decision: CloudRiskDecision = { allowed: true }) {}

  decide(_input?: CloudRiskDecisionInput): CloudRiskDecision {
    return this.decision;
  }
}

export function createSupportAccessGrant(input: SupportAccessGrantInput): SupportAccessGrant {
  const supportUserId = input.supportUserId.trim();
  if (!supportUserId) throw new SupportAccessError('supportUserId is required');
  const reason = input.reason.trim();
  if (!reason) throw new SupportAccessError('Support grant reason is required');
  if (!input.allowedActions.length) throw new SupportAccessError('Support grant requires at least one allowed action');
  return {
    tenant: normalizeCloudTenantContext(input.tenant),
    supportUserId,
    reason,
    allowedActions: [...new Set(input.allowedActions)],
    expiresAt: input.expiresAt,
    createdAt: input.createdAt ?? new Date(),
  };
}

export function requireSupportAccess(grant: SupportAccessGrant, action: CloudCapability, now = new Date()): void {
  if (grant.expiresAt.getTime() <= now.getTime()) {
    throw new SupportAccessError('Support grant has expired');
  }
  if (!grant.allowedActions.includes(action)) {
    throw new SupportAccessError(`Support grant does not allow action ${action}`);
  }
}

function redactObject(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((entry) => redactObject(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      redactObject(entryValue, entryKey),
    ]));
  }
  if (isSensitiveKey(key)) return '[REDACTED]';
  return value;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (normalized === 'secretref' || normalized.endsWith('secretref')) return false;
  return normalized.includes('secret')
    || normalized.includes('password')
    || normalized.includes('privatekey')
    || normalized.includes('apikey')
    || normalized.includes('token')
    || normalized.includes('authorization')
    || normalized === 'dburl'
    || normalized.includes('databaseurl');
}
