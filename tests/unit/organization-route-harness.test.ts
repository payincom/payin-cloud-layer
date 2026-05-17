import { describe, expect, it } from 'vitest';
import { createCloudOrganizationRouteHandlers, type CloudOrganizationService } from '../../src/index.js';

describe('Cloud organization route harness', () => {
  it('maps current organization and update routes', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudOrganizationRouteHandlers({
      organizations: {
        async getCurrentOrganization(input: unknown) { calls.push(['get', input]); return { id: 'org-route', name: 'Org', slug: 'org', planType: 'pro' }; },
        async updateOrganization(input: unknown) { calls.push(['update', input]); return { id: 'org-route', name: 'Updated', slug: 'updated', planType: 'pro' }; },
        async listMembers() { throw new Error('unused'); },
        async addMember() { throw new Error('unused'); },
        async updateMember() { throw new Error('unused'); },
      } as Pick<CloudOrganizationService, 'getCurrentOrganization' | 'updateOrganization' | 'listMembers' | 'addMember' | 'updateMember'>,
    });

    await expect(handlers.getCurrentOrganization({ headers: { authorization: 'Bearer pk' }, body: undefined })).resolves.toEqual({ status: 200, body: { data: { id: 'org-route', name: 'Org', slug: 'org', planType: 'pro' } } });
    await expect(handlers.updateOrganization({ headers: { authorization: 'Bearer pk' }, body: { name: 'Updated', slug: 'updated' } })).resolves.toEqual({ status: 200, body: { data: { id: 'org-route', name: 'Updated', slug: 'updated', planType: 'pro' } } });
    expect(calls).toEqual([
      ['get', { apiKey: 'pk' }],
      ['update', { apiKey: 'pk', name: 'Updated', slug: 'updated' }],
    ]);
  });

  it('maps member management routes', async () => {
    const calls: unknown[] = [];
    const handlers = createCloudOrganizationRouteHandlers({
      organizations: {
        async getCurrentOrganization() { throw new Error('unused'); },
        async updateOrganization() { throw new Error('unused'); },
        async listMembers(input: unknown) { calls.push(['list', input]); return [{ organizationId: 'org-route', userId: 'user-1', role: 'admin', status: 'active' }]; },
        async addMember(input: unknown) { calls.push(['add', input]); return { organizationId: 'org-route', userId: 'user-2', role: 'member', status: 'active' }; },
        async updateMember(input: unknown) { calls.push(['update', input]); return { organizationId: 'org-route', userId: 'user-2', role: 'viewer', status: 'active' }; },
      } as Pick<CloudOrganizationService, 'getCurrentOrganization' | 'updateOrganization' | 'listMembers' | 'addMember' | 'updateMember'>,
    });

    await expect(handlers.listMembers({ headers: { authorization: 'Bearer pk' }, body: undefined })).resolves.toEqual({ status: 200, body: { data: [{ organizationId: 'org-route', userId: 'user-1', role: 'admin', status: 'active' }] } });
    await expect(handlers.addMember({ headers: { authorization: 'Bearer pk' }, body: { userId: 'user-2', role: 'member' } })).resolves.toEqual({ status: 201, body: { data: { organizationId: 'org-route', userId: 'user-2', role: 'member', status: 'active' } } });
    await expect(handlers.updateMember({ headers: { authorization: 'Bearer pk' }, params: { userId: 'user-2' }, body: { role: 'viewer', status: 'active' } })).resolves.toEqual({ status: 200, body: { data: { organizationId: 'org-route', userId: 'user-2', role: 'viewer', status: 'active' } } });

    expect(calls).toEqual([
      ['list', { apiKey: 'pk' }],
      ['add', { apiKey: 'pk', userId: 'user-2', role: 'member' }],
      ['update', { apiKey: 'pk', userId: 'user-2', role: 'viewer', status: 'active' }],
    ]);
  });
});
