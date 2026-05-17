import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';
import { redactCloudAuditMetadata } from './audit-risk.js';

export type RuntimeReadinessStatus = 'pass' | 'warn' | 'fail';

export interface RuntimeReadinessCheck {
  name: string;
  status: RuntimeReadinessStatus;
  message?: string;
  remediation?: string;
  details?: Record<string, unknown>;
}

export interface RuntimeReadinessSummary {
  status: RuntimeReadinessStatus;
  totals: Record<RuntimeReadinessStatus, number>;
}

export interface RuntimeReadinessReport extends RuntimeReadinessSummary {
  tenant: NormalizedCloudTenantContext;
  checkedAt: Date;
  checks: RuntimeReadinessCheck[];
}

export interface CloudRuntimeSmokeProbe {
  name: string;
  run(): Promise<RuntimeReadinessCheck | void> | RuntimeReadinessCheck | void;
}

export interface CloudRuntimeSmokeInput {
  tenant: CloudTenantContext;
  probes: CloudRuntimeSmokeProbe[];
  checkedAt?: Date;
}

export function summarizeRuntimeReadiness(checks: RuntimeReadinessCheck[]): RuntimeReadinessSummary {
  const totals = { pass: 0, warn: 0, fail: 0 } satisfies Record<RuntimeReadinessStatus, number>;
  for (const check of checks) totals[check.status] += 1;
  return {
    status: totals.fail > 0 ? 'fail' : totals.warn > 0 ? 'warn' : 'pass',
    totals,
  };
}

export function createRuntimeReadinessReport(input: {
  tenant: CloudTenantContext;
  checks: RuntimeReadinessCheck[];
  checkedAt?: Date;
}): RuntimeReadinessReport {
  const redactedChecks = input.checks.map(redactRuntimeDiagnostic);
  return {
    tenant: normalizeCloudTenantContext(input.tenant),
    checkedAt: input.checkedAt ?? new Date(),
    ...summarizeRuntimeReadiness(redactedChecks),
    checks: redactedChecks,
  };
}

export function redactRuntimeDiagnostic(check: RuntimeReadinessCheck): RuntimeReadinessCheck {
  return {
    ...check,
    ...(check.details ? { details: redactCloudAuditMetadata(check.details) } : {}),
  };
}

export async function runCloudRuntimeSmoke(input: CloudRuntimeSmokeInput): Promise<RuntimeReadinessReport> {
  const checks: RuntimeReadinessCheck[] = [];
  for (const probe of input.probes) {
    try {
      const result = await probe.run();
      checks.push(result ?? { name: probe.name, status: 'pass' });
    } catch (error) {
      checks.push({
        name: probe.name,
        status: 'fail',
        message: error instanceof Error ? error.message : 'Cloud runtime smoke probe failed',
      });
    }
  }
  return createRuntimeReadinessReport({ tenant: input.tenant, checks, checkedAt: input.checkedAt });
}

export function createCloudRuntimeSmokeProbe(name: string, run: CloudRuntimeSmokeProbe['run']): CloudRuntimeSmokeProbe {
  return { name, run };
}
