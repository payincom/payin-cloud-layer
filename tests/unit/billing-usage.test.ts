import { describe, expect, it, vi } from 'vitest';
import {
  InMemoryUsageMeter,
  UsageDuplicateError,
  createUsageDedupeKey,
  summarizeUsage,
  type CloudUsageEvent,
} from '../../src/index.js';

const tenant = { organizationId: 'org-usage', tenantId: 'org-usage', plan: 'pro' };

function event(overrides: Partial<CloudUsageEvent> = {}): CloudUsageEvent {
  return {
    tenant,
    type: 'order.created',
    subjectId: 'order-1',
    quantity: 1,
    occurredAt: new Date('2026-05-16T12:00:00.000Z'),
    ...overrides,
  };
}

describe('Cloud billing usage metering contract', () => {
  it('creates stable usage dedupe keys per tenant/type/subject/period', () => {
    expect(createUsageDedupeKey(event())).toBe('org-usage:order.created:order-1:2026-05');
    expect(createUsageDedupeKey(event({ subjectId: undefined }))).toBe('org-usage:order.created:2026-05-16T12:00:00.000Z:2026-05');
  });

  it('records usage events once and rejects duplicates in strict mode', async () => {
    const meter = new InMemoryUsageMeter({ duplicatePolicy: 'strict' });

    await meter.recordUsage(event());
    expect(() => meter.recordUsage(event())).toThrow(UsageDuplicateError);
    expect(await meter.listUsage({ tenantId: 'org-usage' })).toHaveLength(1);
  });

  it('ignores duplicate usage events when configured for idempotent mode', async () => {
    const meter = new InMemoryUsageMeter({ duplicatePolicy: 'ignore' });

    await meter.recordUsage(event());
    await meter.recordUsage(event());

    expect(await meter.listUsage({ tenantId: 'org-usage' })).toHaveLength(1);
  });

  it('filters usage by tenant, type, and time window', async () => {
    const meter = new InMemoryUsageMeter();
    await meter.recordUsage(event({ subjectId: 'order-1', occurredAt: new Date('2026-05-16T12:00:00.000Z') }));
    await meter.recordUsage(event({ subjectId: 'order-2', occurredAt: new Date('2026-05-17T12:00:00.000Z') }));
    await meter.recordUsage(event({ tenant: { organizationId: 'org-other', tenantId: 'org-other' }, subjectId: 'order-3' }));
    await meter.recordUsage(event({ type: 'webhook.tested', subjectId: 'webhook-1' }));

    expect(await meter.listUsage({
      tenantId: 'org-usage',
      type: 'order.created',
      from: new Date('2026-05-17T00:00:00.000Z'),
      to: new Date('2026-05-18T00:00:00.000Z'),
    })).toMatchObject([
      { subjectId: 'order-2', type: 'order.created' },
    ]);
  });

  it('summarizes usage quantities by type for a billing period', async () => {
    const meter = new InMemoryUsageMeter();
    await meter.recordUsage(event({ subjectId: 'order-1', quantity: 1 }));
    await meter.recordUsage(event({ subjectId: 'order-2', quantity: 2 }));
    await meter.recordUsage(event({ type: 'payment_link.created', subjectId: 'plink-1', quantity: 1 }));

    const summary = summarizeUsage(await meter.listUsage({ tenantId: 'org-usage' }), '2026-05');

    expect(summary).toEqual({
      tenantId: 'org-usage',
      period: '2026-05',
      totals: {
        'order.created': 3,
        'payment_link.created': 1,
      },
    });
  });

  it('can notify observers after successful usage recording', async () => {
    const observer = vi.fn();
    const meter = new InMemoryUsageMeter({ onRecorded: observer });

    await meter.recordUsage(event());

    expect(observer).toHaveBeenCalledWith(expect.objectContaining({ type: 'order.created', subjectId: 'order-1' }));
  });
});
