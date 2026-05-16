import type { CloudCapability } from './entitlements.js';

export const CloudOrganizationRoles = ['owner', 'admin', 'member', 'viewer'] as const;
export type CloudOrganizationRole = (typeof CloudOrganizationRoles)[number];

export const CloudOrganizationPlans = ['free', 'pro', 'enterprise'] as const;
export type CloudOrganizationPlan = (typeof CloudOrganizationPlans)[number];

export const CloudMembershipStatuses = ['pending', 'active', 'suspended'] as const;
export type CloudMembershipStatus = (typeof CloudMembershipStatuses)[number];

export interface CloudOrganization {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  website?: string;
  description?: string;
  planType: CloudOrganizationPlan;
  monthlyOrderLimit?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CloudOrganizationMember {
  id?: string;
  organizationId: string;
  userId: string;
  role: CloudOrganizationRole;
  status: CloudMembershipStatus;
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt?: Date;
  createdAt?: Date;
}

export interface CloudOrganizationWithRole {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  planType: CloudOrganizationPlan;
  role: CloudOrganizationRole;
  memberStatus: CloudMembershipStatus;
  createdAt?: Date;
}

export interface CloudMembershipVerificationResult {
  valid: boolean;
  role?: CloudOrganizationRole;
  status?: CloudMembershipStatus;
  error?: string;
}

export interface CreateCloudOrganizationInput {
  name: string;
  slug?: string;
  avatarUrl?: string | null;
  website?: string | null;
  description?: string | null;
  planType?: CloudOrganizationPlan;
  monthlyOrderLimit?: number | null;
}

export interface UpdateCloudOrganizationInput {
  name?: string;
  slug?: string;
  avatarUrl?: string | null;
  website?: string | null;
  description?: string | null;
  planType?: CloudOrganizationPlan;
  monthlyOrderLimit?: number | null;
}

export interface CloudOrganizationDraftFields {
  name: string;
  slug: string;
  avatarUrl?: string | null;
  website?: string | null;
  description?: string | null;
  planType: CloudOrganizationPlan;
  monthlyOrderLimit?: number | null;
}

export interface CloudOrganizationCreateDraft {
  organization: CloudOrganizationDraftFields;
  ownerMember: Omit<CloudOrganizationMember, 'id' | 'organizationId' | 'createdAt'>;
  /** Slug uniqueness must be enforced by storage adapters because only they know the namespace. */
  slugUniqueness: 'adapter-owned';
}

export type CloudOrganizationUpdateDraft = Partial<CloudOrganizationDraftFields>;

export interface InviteCloudMemberInput {
  email: string;
  role: Exclude<CloudOrganizationRole, 'owner'>;
}

export interface CloudMemberInviteDraft {
  organizationId: string;
  email: string;
  role: Exclude<CloudOrganizationRole, 'owner'>;
  status: 'pending';
  invitedBy: string;
  invitedAt: Date;
}

export type CloudMemberAddDraft = Omit<CloudOrganizationMember, 'id' | 'createdAt'>;

export interface UpdateCloudMemberInput {
  role?: CloudOrganizationRole;
  status?: CloudMembershipStatus;
}

export interface CloudOwnershipTransferRoleUpdate {
  userId: string;
  role: CloudOrganizationRole;
}

export type CloudOrganizationPermission =
  | CloudCapability
  | 'organization:create'
  | 'organization:read'
  | 'organization:update'
  | 'organization:delete'
  | 'members:list'
  | 'members:invite'
  | 'members:add'
  | 'members:update'
  | 'members:remove'
  | 'ownership:transfer';

export const CLOUD_ROLE_CAPABILITIES: Readonly<Record<CloudOrganizationRole, readonly CloudCapability[]>> = {
  owner: [
    'orders:create',
    'orders:read',
    'payment-links:create',
    'payment-links:update',
    'payment-links:read',
    'api-keys:create',
    'api-keys:read',
    'api-keys:revoke',
    'address-pool:import',
    'address-pool:read',
    'webhooks:test',
    'webhooks:read',
    'config:read',
    'config:update',
  ],
  admin: [
    'orders:create',
    'orders:read',
    'payment-links:create',
    'payment-links:update',
    'payment-links:read',
    'api-keys:create',
    'api-keys:read',
    'api-keys:revoke',
    'address-pool:import',
    'address-pool:read',
    'webhooks:test',
    'webhooks:read',
    'config:read',
    'config:update',
  ],
  member: [
    'orders:create',
    'orders:read',
    'payment-links:create',
    'payment-links:update',
    'payment-links:read',
    'address-pool:read',
    'webhooks:read',
    'config:read',
  ],
  viewer: [
    'orders:read',
    'payment-links:read',
    'address-pool:read',
    'webhooks:read',
    'config:read',
  ],
};

export const CLOUD_ORGANIZATION_PERMISSION_MATRIX: Readonly<Record<CloudOrganizationRole, readonly CloudOrganizationPermission[]>> = {
  owner: [
    ...CLOUD_ROLE_CAPABILITIES.owner,
    'organization:create',
    'organization:read',
    'organization:update',
    'organization:delete',
    'members:list',
    'members:invite',
    'members:add',
    'members:update',
    'members:remove',
    'ownership:transfer',
  ],
  admin: [
    ...CLOUD_ROLE_CAPABILITIES.admin,
    'organization:create',
    'organization:read',
    'organization:update',
    'members:list',
    'members:invite',
    'members:add',
    'members:update',
    'members:remove',
  ],
  member: [...CLOUD_ROLE_CAPABILITIES.member, 'organization:read', 'members:list'],
  viewer: [...CLOUD_ROLE_CAPABILITIES.viewer, 'organization:read', 'members:list'],
};

export class CloudOrganizationValidationError extends Error {
  readonly code = 'CLOUD_ORGANIZATION_VALIDATION_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'CloudOrganizationValidationError';
  }
}

export class CloudOrganizationAuthorizationError extends Error {
  readonly code = 'CLOUD_ORGANIZATION_AUTHORIZATION_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'CloudOrganizationAuthorizationError';
  }
}

export function isCloudOrganizationRole(value: string): value is CloudOrganizationRole {
  return (CloudOrganizationRoles as readonly string[]).includes(value);
}

export function isCloudOrganizationPlan(value: string): value is CloudOrganizationPlan {
  return (CloudOrganizationPlans as readonly string[]).includes(value);
}

export function isCloudMembershipStatus(value: string): value is CloudMembershipStatus {
  return (CloudMembershipStatuses as readonly string[]).includes(value);
}

export function hasCloudRoleCapability(role: CloudOrganizationRole, capability: CloudCapability): boolean {
  return CLOUD_ROLE_CAPABILITIES[role].includes(capability);
}

export function hasCloudOrganizationPermission(role: CloudOrganizationRole, permission: CloudOrganizationPermission): boolean {
  return CLOUD_ORGANIZATION_PERMISSION_MATRIX[role].includes(permission);
}

export function verifyCloudMembership(
  member?: Pick<CloudOrganizationMember, 'role' | 'status'> | null
): CloudMembershipVerificationResult {
  if (!member) {
    return { valid: false, error: 'Not a member of this organization' };
  }

  if (member.status !== 'active') {
    return {
      valid: false,
      role: member.role,
      status: member.status,
      error: `Membership status is ${member.status}`,
    };
  }

  return { valid: true, role: member.role, status: member.status };
}

export function assertActiveCloudMembership(
  member?: Pick<CloudOrganizationMember, 'role' | 'status'> | null
): asserts member is Pick<CloudOrganizationMember, 'role' | 'status'> {
  const verification = verifyCloudMembership(member);
  if (!verification.valid) {
    throw new CloudOrganizationAuthorizationError(verification.error ?? 'Active Cloud organization membership is required');
  }
}

export function assertCloudOrganizationPermission(
  member: Pick<CloudOrganizationMember, 'role' | 'status'> | null | undefined,
  permission: CloudOrganizationPermission
): void {
  assertActiveCloudMembership(member);
  if (!hasCloudOrganizationPermission(member.role, permission)) {
    throw new CloudOrganizationAuthorizationError(
      `Cloud organization permission ${permission} requires a higher role`
    );
  }
}

export function createCloudOrganizationDraft(
  ownerUserId: string,
  input: CreateCloudOrganizationInput
): CloudOrganizationCreateDraft {
  const userId = normalizeRequiredIdentifier(ownerUserId, 'ownerUserId');
  const name = normalizeRequiredText(input.name, 'Organization name');
  const slug = input.slug === undefined ? slugifyOrganizationName(name) : normalizeSlug(input.slug);
  const planType = normalizePlan(input.planType ?? 'free');
  const monthlyOrderLimit = normalizeOptionalNonNegativeInteger(input.monthlyOrderLimit, 'monthlyOrderLimit');

  return {
    organization: stripUndefined({
      name,
      slug,
      avatarUrl: normalizeNullableUrl(input.avatarUrl, 'avatarUrl'),
      website: normalizeNullableUrl(input.website, 'website'),
      description: normalizeNullableText(input.description),
      planType,
      monthlyOrderLimit,
    }),
    ownerMember: {
      userId,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    },
    slugUniqueness: 'adapter-owned',
  };
}

export function updateCloudOrganizationDraft(input: UpdateCloudOrganizationInput): CloudOrganizationUpdateDraft {
  return stripUndefined({
    name: input.name === undefined ? undefined : normalizeRequiredText(input.name, 'Organization name'),
    slug: input.slug === undefined ? undefined : normalizeSlug(input.slug),
    avatarUrl: input.avatarUrl === undefined ? undefined : normalizeNullableUrl(input.avatarUrl, 'avatarUrl'),
    website: input.website === undefined ? undefined : normalizeNullableUrl(input.website, 'website'),
    description: input.description === undefined ? undefined : normalizeNullableText(input.description),
    planType: input.planType === undefined ? undefined : normalizePlan(input.planType),
    monthlyOrderLimit:
      input.monthlyOrderLimit === undefined
        ? undefined
        : normalizeOptionalNonNegativeInteger(input.monthlyOrderLimit, 'monthlyOrderLimit'),
  });
}

export function createCloudMemberInviteDraft(
  organizationId: string,
  invitedBy: string,
  input: InviteCloudMemberInput,
  now = new Date()
): CloudMemberInviteDraft {
  return {
    organizationId: normalizeRequiredIdentifier(organizationId, 'organizationId'),
    invitedBy: normalizeRequiredIdentifier(invitedBy, 'invitedBy'),
    email: normalizeInviteEmail(input.email),
    role: normalizeNonOwnerRole(input.role),
    status: 'pending',
    invitedAt: now,
  };
}

export function createCloudMemberAddDraft(
  organizationId: string,
  userId: string,
  role: CloudOrganizationRole,
  invitedBy?: string,
  now = new Date()
): CloudMemberAddDraft {
  const draft: CloudMemberAddDraft = {
    organizationId: normalizeRequiredIdentifier(organizationId, 'organizationId'),
    userId: normalizeRequiredIdentifier(userId, 'userId'),
    role: normalizeNonOwnerRole(role),
    status: 'active',
    joinedAt: now,
  };

  if (invitedBy) {
    draft.invitedBy = normalizeRequiredIdentifier(invitedBy, 'invitedBy');
    draft.invitedAt = now;
  }

  return draft;
}

export function updateCloudMemberDraft(
  existing: Pick<CloudOrganizationMember, 'role' | 'status'>,
  input: UpdateCloudMemberInput
): UpdateCloudMemberInput {
  const nextRole = input.role === undefined ? undefined : normalizeRole(input.role);
  const nextStatus = input.status === undefined ? undefined : normalizeStatus(input.status);

  if (existing.role === 'owner') {
    if (nextRole && nextRole !== 'owner') {
      throw new CloudOrganizationValidationError('Use ownership transfer to change the owner role');
    }
    if (nextStatus && nextStatus !== 'active') {
      throw new CloudOrganizationValidationError('Owner membership cannot be suspended');
    }
  }

  if (nextRole === 'owner' && existing.role !== 'owner') {
    throw new CloudOrganizationValidationError('Use ownership transfer to promote a member to owner');
  }

  return stripUndefined({ role: nextRole, status: nextStatus });
}

export function createOwnershipTransferRoleUpdates(
  currentOwner: Pick<CloudOrganizationMember, 'organizationId' | 'userId' | 'role' | 'status'>,
  targetMember: Pick<CloudOrganizationMember, 'organizationId' | 'userId' | 'role' | 'status'>
): CloudOwnershipTransferRoleUpdate[] {
  if (currentOwner.organizationId !== targetMember.organizationId) {
    throw new CloudOrganizationValidationError('Ownership transfer members must belong to the same organization');
  }
  if (currentOwner.role !== 'owner') {
    throw new CloudOrganizationAuthorizationError('Only the current owner can transfer ownership');
  }
  if (currentOwner.status !== 'active') {
    throw new CloudOrganizationAuthorizationError('Current owner membership must be active');
  }
  if (targetMember.status !== 'active') {
    throw new CloudOrganizationValidationError('Ownership can only transfer to an active member');
  }
  if (targetMember.role === 'owner') {
    throw new CloudOrganizationValidationError('Target member is already the owner');
  }
  if (currentOwner.userId === targetMember.userId) {
    throw new CloudOrganizationValidationError('Ownership transfer target must be a different member');
  }

  return [
    { userId: currentOwner.userId, role: 'admin' },
    { userId: targetMember.userId, role: 'owner' },
  ];
}

function normalizeRequiredIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CloudOrganizationValidationError(`${label} is required`);
  }
  return normalized;
}

function normalizeRequiredText(value: string, label: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new CloudOrganizationValidationError(`${label} is required`);
  }
  return normalized;
}

function normalizeNullableText(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

function normalizeSlug(value: string): string {
  const slug = value.trim();
  if (!slug) {
    throw new CloudOrganizationValidationError('Organization slug is required');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new CloudOrganizationValidationError('Organization slug must use lowercase letters, numbers, and hyphens');
  }
  return slug;
}

function slugifyOrganizationName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new CloudOrganizationValidationError('Organization name must contain letters or numbers for slug suggestion');
  }

  return slug;
}

function normalizePlan(value: CloudOrganizationPlan): CloudOrganizationPlan {
  if (!isCloudOrganizationPlan(value)) {
    throw new CloudOrganizationValidationError('Invalid organization plan');
  }
  return value;
}

function normalizeRole(value: CloudOrganizationRole): CloudOrganizationRole {
  if (!isCloudOrganizationRole(value)) {
    throw new CloudOrganizationValidationError('Invalid organization role');
  }
  return value;
}

function normalizeNonOwnerRole(value: CloudOrganizationRole): Exclude<CloudOrganizationRole, 'owner'> {
  const role = normalizeRole(value);
  if (role === 'owner') {
    throw new CloudOrganizationValidationError('Members cannot be added directly as owner; use ownership transfer');
  }
  return role;
}

function normalizeStatus(value: CloudMembershipStatus): CloudMembershipStatus {
  if (!isCloudMembershipStatus(value)) {
    throw new CloudOrganizationValidationError('Invalid membership status');
  }
  return value;
}

function normalizeOptionalNonNegativeInteger(value: number | null | undefined, label: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new CloudOrganizationValidationError(`${label} must be a non-negative integer`);
  }
  return value;
}

function normalizeNullableUrl(value: string | null | undefined, label: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new CloudOrganizationValidationError(`${label} must be an http(s) URL`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new CloudOrganizationValidationError(`${label} must be an http(s) URL`);
  }

  return normalized;
}

function normalizeInviteEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CloudOrganizationValidationError('Invite email must be valid');
  }
  return email;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
