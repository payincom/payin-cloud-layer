import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';

export type CloudPaymentLinkStatus = 'draft' | 'published' | 'archived';
export type CloudPaymentLinkOrderStatus = 'pending' | 'completed' | 'expired' | 'cancelled';

export interface CloudPaymentLink {
  id: string;
  tenant: CloudTenantContext | NormalizedCloudTenantContext;
  title: string;
  description?: string;
  amount: string;
  currency: string;
  chainOptions: string[];
  status: CloudPaymentLinkStatus;
  slug?: string;
  inventoryTotal?: number | null;
  inventoryReserved?: number;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NormalizedCloudPaymentLink extends Omit<CloudPaymentLink, 'tenant' | 'inventoryReserved'> {
  tenant: NormalizedCloudTenantContext;
  inventoryReserved: number;
}

export interface PublishedCloudPaymentLink extends NormalizedCloudPaymentLink {
  status: 'published';
  slug: string;
  slugUniqueness: 'adapter-owned';
}

export interface PublicPaymentLinkView {
  id: string;
  slug: string;
  title: string;
  description?: string;
  amount: string;
  currency: string;
  chainOptions: string[];
  availableInventory: number | null;
  status: 'published';
}

export interface PaymentLinkOrderDraft {
  tenant: NormalizedCloudTenantContext;
  paymentLinkId: string;
  buyerEmail: string;
  chainId: string;
  amount: string;
  currency: string;
  status: CloudPaymentLinkOrderStatus;
}

export class CloudPaymentLinkValidationError extends Error {
  readonly code = 'CLOUD_PAYMENT_LINK_VALIDATION_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'CloudPaymentLinkValidationError';
  }
}

export class CloudPaymentLinkStateError extends Error {
  readonly code = 'CLOUD_PAYMENT_LINK_STATE_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'CloudPaymentLinkStateError';
  }
}

export class CloudPaymentLinkInventoryError extends Error {
  readonly code = 'CLOUD_PAYMENT_LINK_INVENTORY_EXCEEDED';

  constructor(message = 'Payment link inventory is not available') {
    super(message);
    this.name = 'CloudPaymentLinkInventoryError';
  }
}

export function normalizeCloudPaymentLink(input: CloudPaymentLink): NormalizedCloudPaymentLink {
  const title = input.title.trim();
  if (!title) throw new CloudPaymentLinkValidationError('Payment link title is required');
  if (!/^\d+(?:\.\d+)?$/.test(input.amount) || Number(input.amount) <= 0) {
    throw new CloudPaymentLinkValidationError('Payment link amount must be a positive decimal string');
  }
  if (!/^[A-Z][A-Z0-9]{1,15}$/.test(input.currency)) {
    throw new CloudPaymentLinkValidationError('Payment link currency must be an uppercase symbol');
  }
  if (!input.chainOptions.length) {
    throw new CloudPaymentLinkValidationError('Payment link requires at least one chain option');
  }
  assertOptionalNonNegativeInteger(input.inventoryTotal, 'inventoryTotal');
  assertOptionalNonNegativeInteger(input.inventoryReserved, 'inventoryReserved');

  return {
    ...input,
    tenant: normalizeCloudTenantContext(input.tenant),
    title,
    description: input.description?.trim() || undefined,
    currency: input.currency.trim(),
    chainOptions: [...new Set(input.chainOptions.map((chain) => chain.trim()).filter(Boolean))],
    inventoryReserved: input.inventoryReserved ?? 0,
  };
}

export function publishCloudPaymentLink(
  link: CloudPaymentLink,
  options: { slug?: string } = {}
): PublishedCloudPaymentLink {
  const normalized = normalizeCloudPaymentLink(link);
  if (normalized.status !== 'draft' && normalized.status !== 'published') {
    throw new CloudPaymentLinkStateError('Only draft or published payment links can be published');
  }
  const slug = normalizePaymentLinkSlug(options.slug ?? normalized.slug ?? slugify(normalized.title));
  return {
    ...normalized,
    status: 'published',
    slug,
    slugUniqueness: 'adapter-owned',
  };
}

export function createPublicPaymentLinkView(link: CloudPaymentLink): PublicPaymentLinkView {
  const published = publishCloudPaymentLink(link, { slug: link.slug });
  return {
    id: published.id,
    slug: published.slug,
    title: published.title,
    description: published.description,
    amount: published.amount,
    currency: published.currency,
    chainOptions: published.chainOptions,
    availableInventory: getAvailableInventory(published),
    status: 'published',
  };
}

export function reservePaymentLinkInventory(link: CloudPaymentLink, quantity = 1): NormalizedCloudPaymentLink {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new CloudPaymentLinkInventoryError('Inventory reservation quantity must be a positive integer');
  }
  const normalized = normalizeCloudPaymentLink(link);
  if (normalized.status !== 'published') {
    throw new CloudPaymentLinkStateError('Payment link must be published before inventory reservation');
  }

  if (normalized.inventoryTotal != null && normalized.inventoryReserved + quantity > normalized.inventoryTotal) {
    throw new CloudPaymentLinkInventoryError();
  }

  return {
    ...normalized,
    inventoryReserved: normalized.inventoryReserved + quantity,
  };
}

export function createPaymentLinkOrderDraft(
  link: CloudPaymentLink,
  input: { buyerEmail: string; chainId: string }
): PaymentLinkOrderDraft {
  const normalized = normalizeCloudPaymentLink(link);
  if (normalized.status !== 'published') {
    throw new CloudPaymentLinkStateError('Payment link must be published before checkout');
  }
  const email = input.buyerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CloudPaymentLinkValidationError('Buyer email must be valid');
  }
  if (!normalized.chainOptions.includes(input.chainId)) {
    throw new CloudPaymentLinkValidationError('Requested chain is not enabled for this payment link');
  }

  return {
    tenant: normalized.tenant,
    paymentLinkId: normalized.id,
    buyerEmail: email,
    chainId: input.chainId,
    amount: normalized.amount,
    currency: normalized.currency,
    status: 'pending',
  };
}

function getAvailableInventory(link: NormalizedCloudPaymentLink): number | null {
  if (link.inventoryTotal == null) return null;
  return Math.max(0, link.inventoryTotal - link.inventoryReserved);
}

function normalizePaymentLinkSlug(slug: string): string {
  const normalized = slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new CloudPaymentLinkValidationError('Payment link slug must use lowercase letters, numbers, and hyphens');
  }
  return normalized;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'payment-link';
}

function assertOptionalNonNegativeInteger(value: number | null | undefined, field: string): void {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 0) {
    throw new CloudPaymentLinkValidationError(`${field} must be a non-negative integer`);
  }
}
