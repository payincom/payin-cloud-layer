import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';
import type { CloudWebhookEventType } from './webhooks.js';

export type CloudWebhookDeliveryStatus = 'queued' | 'processing' | 'retry_scheduled' | 'succeeded' | 'failed';

export interface CloudWebhookDeliveryRecordInput {
  id: string;
  tenant: CloudTenantContext;
  endpointId: string;
  eventId: string;
  eventType: CloudWebhookEventType;
  url: string;
  headers: Record<string, string>;
  body: string;
  status?: CloudWebhookDeliveryStatus;
  attemptCount?: number;
  lastStatusCode?: number;
  errorMessage?: string;
  nextAttemptAt?: Date;
  deliveredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CloudWebhookDeliveryRecord extends Omit<CloudWebhookDeliveryRecordInput, 'tenant' | 'status' | 'attemptCount'> {
  tenant: NormalizedCloudTenantContext;
  status: CloudWebhookDeliveryStatus;
  attemptCount: number;
}

export interface CloudNotificationDeliveryRepository {
  enqueue(record: CloudWebhookDeliveryRecord): Promise<CloudWebhookDeliveryRecord> | CloudWebhookDeliveryRecord;
  listForTenant(tenant: CloudTenantContext): Promise<CloudWebhookDeliveryRecord[]> | CloudWebhookDeliveryRecord[];
  claimDue(input: { now: Date; limit: number }): Promise<CloudWebhookDeliveryRecord[]> | CloudWebhookDeliveryRecord[];
  replace(record: CloudWebhookDeliveryRecord): Promise<CloudWebhookDeliveryRecord> | CloudWebhookDeliveryRecord;
}

export function createCloudWebhookDeliveryRecord(input: CloudWebhookDeliveryRecordInput): CloudWebhookDeliveryRecord {
  return {
    ...input,
    tenant: normalizeCloudTenantContext(input.tenant),
    status: input.status ?? 'queued',
    attemptCount: input.attemptCount ?? 0,
    createdAt: input.createdAt ?? new Date(),
    updatedAt: input.updatedAt ?? input.createdAt ?? new Date(),
  };
}

export function markCloudWebhookDeliverySucceeded(
  record: CloudWebhookDeliveryRecord,
  input: { statusCode: number; deliveredAt?: Date }
): CloudWebhookDeliveryRecord {
  const deliveredAt = input.deliveredAt ?? new Date();
  return {
    ...record,
    status: 'succeeded',
    attemptCount: record.attemptCount + 1,
    lastStatusCode: input.statusCode,
    errorMessage: undefined,
    nextAttemptAt: undefined,
    deliveredAt,
    updatedAt: deliveredAt,
  };
}

export function markCloudWebhookDeliveryFailed(
  record: CloudWebhookDeliveryRecord,
  input: { statusCode?: number; errorMessage?: string; failedAt?: Date; nextAttemptAt?: Date }
): CloudWebhookDeliveryRecord {
  const failedAt = input.failedAt ?? new Date();
  return {
    ...record,
    status: input.nextAttemptAt ? 'retry_scheduled' : 'failed',
    attemptCount: record.attemptCount + 1,
    lastStatusCode: input.statusCode,
    errorMessage: input.errorMessage,
    nextAttemptAt: input.nextAttemptAt,
    updatedAt: failedAt,
  };
}

export class InMemoryCloudNotificationDeliveryRepository implements CloudNotificationDeliveryRepository {
  private readonly records = new Map<string, CloudWebhookDeliveryRecord>();

  enqueue(record: CloudWebhookDeliveryRecord): CloudWebhookDeliveryRecord {
    this.records.set(record.id, record);
    return record;
  }

  listForTenant(tenant: CloudTenantContext): CloudWebhookDeliveryRecord[] {
    const normalized = normalizeCloudTenantContext(tenant);
    return [...this.records.values()]
      .filter((record) => record.tenant.organizationId === normalized.organizationId)
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  }

  claimDue(input: { now: Date; limit: number }): CloudWebhookDeliveryRecord[] {
    const due = [...this.records.values()]
      .filter((record) => (record.status === 'queued' || record.status === 'retry_scheduled') && (!record.nextAttemptAt || record.nextAttemptAt.getTime() <= input.now.getTime()))
      .sort((a, b) => (a.nextAttemptAt ?? a.createdAt!).getTime() - (b.nextAttemptAt ?? b.createdAt!).getTime())
      .slice(0, input.limit)
      .map((record) => ({ ...record, status: 'processing' as const, updatedAt: input.now }));
    for (const record of due) this.records.set(record.id, record);
    return due;
  }

  replace(record: CloudWebhookDeliveryRecord): CloudWebhookDeliveryRecord {
    this.records.set(record.id, record);
    return record;
  }
}
