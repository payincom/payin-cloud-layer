import type { CloudTenantContext } from './context.js';
import type { CloudCapability } from './entitlements.js';

export interface CloudUsageEvent {
  tenant: CloudTenantContext;
  type:
    | 'order.created'
    | 'payment_link.created'
    | 'api_key.created'
    | 'api_key.revoked'
    | 'address_pool.imported'
    | 'webhook.tested';
  subjectId?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export interface CloudAuditEvent {
  tenant: CloudTenantContext;
  action: CloudCapability;
  subjectId?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingUsageReporter {
  recordUsage(event: CloudUsageEvent): Promise<void> | void;
}

export interface CloudAuditLogger {
  record(event: CloudAuditEvent): Promise<void> | void;
}

export type CloudSideEffectPolicy = 'strict' | 'best-effort';

export class NoopBillingUsageReporter implements BillingUsageReporter {
  recordUsage(): void {
    // Dev/test implementation. Production Cloud should inject a real reporter.
  }
}

export class NoopCloudAuditLogger implements CloudAuditLogger {
  record(): void {
    // Dev/test implementation. Production Cloud should inject a real audit logger.
  }
}

export async function runCloudSideEffect(
  policy: CloudSideEffectPolicy,
  operation: () => Promise<void> | void,
  onError?: (error: unknown) => void
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (policy === 'strict') throw error;
    onError?.(error);
  }
}
