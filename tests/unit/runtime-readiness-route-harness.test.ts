import { describe, expect, it } from 'vitest';
import { createCloudRuntimeReadinessRouteHandlers, createRuntimeReadinessReport } from '../../src/index.js';

const tenant = { organizationId: 'org-ready-route', tenantId: 'org-ready-route' };

describe('Cloud runtime readiness route harness', () => {
  it('maps readiness and smoke reports to route responses', async () => {
    const calls: unknown[] = [];
    const pass = createRuntimeReadinessReport({ tenant, checkedAt: new Date('2026-05-17T06:03:00.000Z'), checks: [{ name: 'config', status: 'pass' }] });
    const fail = createRuntimeReadinessReport({ tenant, checkedAt: new Date('2026-05-17T06:04:00.000Z'), checks: [{ name: 'webhook', status: 'fail', message: 'missing endpoint' }] });
    const routes = createCloudRuntimeReadinessRouteHandlers({
      readiness: {
        getReadiness: async (input) => { calls.push(['readiness', input]); return pass; },
        runSmoke: async (input) => { calls.push(['smoke', input]); return fail; },
      },
    });

    await expect(routes.getReadiness({ headers: { authorization: 'Bearer pk_ready' }, body: undefined })).resolves.toEqual({ status: 200, body: { data: pass } });
    await expect(routes.runSmoke({ headers: { authorization: 'Bearer pk_ready' }, body: undefined })).resolves.toEqual({ status: 503, body: { data: fail } });
    expect(calls).toEqual([
      ['readiness', { apiKey: 'pk_ready' }],
      ['smoke', { apiKey: 'pk_ready' }],
    ]);
  });

  it('requires bearer API key at the route edge', async () => {
    const routes = createCloudRuntimeReadinessRouteHandlers({
      readiness: {
        getReadiness: async () => { throw new Error('unused'); },
        runSmoke: async () => { throw new Error('unused'); },
      },
    });

    await expect(routes.getReadiness({ headers: {}, body: undefined })).resolves.toEqual({
      status: 401,
      body: { error: { code: 'CLOUD_ROUTE_UNAUTHORIZED', message: 'Bearer API key is required' } },
    });
  });
});
