import { createCloudAuditEvent, type CloudAuditTrail } from '../audit-risk.js';
import { CloudApiKeyAuthenticator, type CloudApiKeyScope } from '../api-key.js';
import type { EntitlementProvider } from '../entitlements.js';
import {
  assertCloudOrganizationPermission,
  createCloudMemberAddDraft,
  type CloudOrganization,
  type CloudOrganizationMember,
  type CloudOrganizationRepository,
  type CloudOrganizationRole,
  type CloudMembershipStatus,
  type UpdateCloudOrganizationInput,
  updateCloudOrganizationDraft,
  updateCloudMemberDraft,
} from '../organization.js';

export interface CloudOrganizationServiceOptions {
  authenticator: CloudApiKeyAuthenticator;
  entitlementProvider: EntitlementProvider;
  organizations: CloudOrganizationRepository;
  auditTrail: CloudAuditTrail;
}

export interface CloudOrganizationScopedRequest { apiKey: string }
export interface CloudOrganizationUpdateServiceRequest extends UpdateCloudOrganizationInput { apiKey: string; now?: Date }
export interface CloudOrganizationAddMemberServiceRequest { apiKey: string; userId: string; role: Exclude<CloudOrganizationRole, 'owner'>; now?: Date }
export interface CloudOrganizationUpdateMemberServiceRequest { apiKey: string; userId: string; role?: CloudOrganizationRole; status?: CloudMembershipStatus; now?: Date }

export class CloudOrganizationService {
  constructor(private readonly options: CloudOrganizationServiceOptions) {}

  async getCurrentOrganization(request: CloudOrganizationScopedRequest): Promise<CloudOrganization> {
    const scope = await this.authenticate(request.apiKey);
    assertCloudOrganizationPermission({ role: scope.role ?? 'viewer', status: 'active' }, 'organization:read');
    await this.options.entitlementProvider.assertAllowed(scope.tenant, 'config:read');
    const organization = await this.options.organizations.getByTenant(scope.tenant);
    if (!organization) throw new Error(`Organization not found: ${scope.tenant.organizationId}`);
    return organization;
  }

  async updateOrganization(request: CloudOrganizationUpdateServiceRequest): Promise<CloudOrganization> {
    const scope = await this.authenticate(request.apiKey);
    assertCloudOrganizationPermission({ role: scope.role ?? 'viewer', status: 'active' }, 'organization:update');
    await this.options.entitlementProvider.assertAllowed(scope.tenant, 'config:update');
    const updated = await this.options.organizations.updateByTenant(scope.tenant, updateCloudOrganizationDraft(request));
    await this.recordAudit(scope, 'config:update', updated.id, request.now, { resource: 'organization' });
    return updated;
  }

  async listMembers(request: CloudOrganizationScopedRequest): Promise<CloudOrganizationMember[]> {
    const scope = await this.authenticate(request.apiKey);
    assertCloudOrganizationPermission({ role: scope.role ?? 'viewer', status: 'active' }, 'members:list');
    await this.options.entitlementProvider.assertAllowed(scope.tenant, 'config:read');
    return this.options.organizations.listMembers(scope.tenant);
  }

  async addMember(request: CloudOrganizationAddMemberServiceRequest): Promise<CloudOrganizationMember> {
    const scope = await this.authenticate(request.apiKey);
    assertCloudOrganizationPermission({ role: scope.role ?? 'viewer', status: 'active' }, 'members:add');
    await this.options.entitlementProvider.assertAllowed(scope.tenant, 'config:update');
    const member = await this.options.organizations.addMember(createCloudMemberAddDraft(scope.tenant.organizationId, request.userId, request.role, scope.userId, request.now));
    await this.recordAudit(scope, 'config:update', member.userId, request.now, { resource: 'organization_member', operation: 'add', role: member.role });
    return member;
  }

  async updateMember(request: CloudOrganizationUpdateMemberServiceRequest): Promise<CloudOrganizationMember> {
    const scope = await this.authenticate(request.apiKey);
    assertCloudOrganizationPermission({ role: scope.role ?? 'viewer', status: 'active' }, 'members:update');
    await this.options.entitlementProvider.assertAllowed(scope.tenant, 'config:update');
    const existing = await this.options.organizations.getMember(scope.tenant, request.userId);
    if (!existing) throw new Error(`Organization member not found: ${request.userId}`);
    const updates = updateCloudMemberDraft(existing, { role: request.role, status: request.status });
    const member = await this.options.organizations.updateMember(scope.tenant, request.userId, updates);
    await this.recordAudit(scope, 'config:update', member.userId, request.now, { resource: 'organization_member', operation: 'update', role: member.role, status: member.status });
    return member;
  }

  private async authenticate(apiKey: string): Promise<CloudApiKeyScope> {
    return this.options.authenticator.authenticate(apiKey);
  }

  private async recordAudit(scope: CloudApiKeyScope, action: 'config:update', subjectId: string, occurredAt?: Date, metadata?: Record<string, unknown>): Promise<void> {
    await this.options.auditTrail.record(createCloudAuditEvent({
      tenant: scope.tenant,
      action,
      actor: { type: 'api_key', id: scope.apiKeyId },
      subjectId,
      occurredAt,
      metadata,
    }));
  }
}
