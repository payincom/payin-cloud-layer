import type { CloudUsageEvent } from './hooks.js';

export type UsageDuplicatePolicy = 'strict' | 'ignore';

export interface UsageMeterOptions {
  duplicatePolicy?: UsageDuplicatePolicy;
  onRecorded?: (event: RequiredUsageEvent) => void;
}

export interface UsageQuery {
  tenantId?: string;
  type?: CloudUsageEvent['type'];
  from?: Date;
  to?: Date;
}

export interface UsageSummary {
  tenantId: string;
  period: string;
  totals: Partial<Record<CloudUsageEvent['type'], number>>;
}

export interface RequiredUsageEvent extends CloudUsageEvent {
  quantity: number;
  occurredAt: Date;
  dedupeKey: string;
}

export class UsageDuplicateError extends Error {
  readonly code = 'USAGE_DUPLICATE';

  constructor(public readonly dedupeKey: string) {
    super(`Duplicate usage event: ${dedupeKey}`);
    this.name = 'UsageDuplicateError';
  }
}

export interface UsageMeter {
  recordUsage(event: CloudUsageEvent): Promise<void> | void;
  listUsage(query?: UsageQuery): Promise<RequiredUsageEvent[]> | RequiredUsageEvent[];
}

export function createUsageDedupeKey(event: CloudUsageEvent): string {
  const occurredAt = event.occurredAt ?? new Date(0);
  const period = toBillingPeriod(occurredAt);
  const subject = event.subjectId ?? occurredAt.toISOString();
  return `${event.tenant.organizationId}:${event.type}:${subject}:${period}`;
}

export function normalizeUsageEvent(event: CloudUsageEvent): RequiredUsageEvent {
  const normalized: RequiredUsageEvent = {
    ...event,
    quantity: event.quantity ?? 1,
    occurredAt: event.occurredAt ?? new Date(),
    dedupeKey: '',
  };
  normalized.dedupeKey = createUsageDedupeKey(normalized);
  return normalized;
}

export class InMemoryUsageMeter implements UsageMeter {
  private readonly events = new Map<string, RequiredUsageEvent>();
  private readonly duplicatePolicy: UsageDuplicatePolicy;
  private readonly onRecorded?: (event: RequiredUsageEvent) => void;

  constructor(options: UsageMeterOptions = {}) {
    this.duplicatePolicy = options.duplicatePolicy ?? 'strict';
    this.onRecorded = options.onRecorded;
  }

  recordUsage(event: CloudUsageEvent): void {
    const normalized = normalizeUsageEvent(event);

    if (this.events.has(normalized.dedupeKey)) {
      if (this.duplicatePolicy === 'ignore') return;
      throw new UsageDuplicateError(normalized.dedupeKey);
    }

    this.events.set(normalized.dedupeKey, normalized);
    this.onRecorded?.(normalized);
  }

  listUsage(query: UsageQuery = {}): RequiredUsageEvent[] {
    return [...this.events.values()].filter((event) => {
      if (query.tenantId && event.tenant.organizationId !== query.tenantId && event.tenant.tenantId !== query.tenantId) return false;
      if (query.type && event.type !== query.type) return false;
      if (query.from && event.occurredAt.getTime() < query.from.getTime()) return false;
      if (query.to && event.occurredAt.getTime() >= query.to.getTime()) return false;
      return true;
    });
  }
}

export function summarizeUsage(events: CloudUsageEvent[], period: string): UsageSummary {
  if (!events.length) {
    throw new Error('Cannot summarize empty usage events');
  }

  const tenantId = events[0].tenant.organizationId;
  const totals: Partial<Record<CloudUsageEvent['type'], number>> = {};

  for (const event of events) {
    if (event.tenant.organizationId !== tenantId) {
      throw new Error('Cannot summarize usage across multiple tenants');
    }

    const occurredAt = event.occurredAt ?? new Date(0);
    if (toBillingPeriod(occurredAt) !== period) continue;

    totals[event.type] = (totals[event.type] ?? 0) + (event.quantity ?? 1);
  }

  return { tenantId, period, totals };
}

export function toBillingPeriod(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
