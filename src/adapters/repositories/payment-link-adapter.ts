import { normalizeCloudPaymentLink, type CloudPaymentLink, type NormalizedCloudPaymentLink } from '../../payment-links.js';
import type { CloudTenantContext } from '../../context.js';
import type { CloudPaymentLinkPort } from '../../ports.js';

export interface CloudPaymentLinkRepository {
  save(link: CloudPaymentLink): Promise<NormalizedCloudPaymentLink> | NormalizedCloudPaymentLink;
  findByTenant(paymentLinkId: string, tenant: CloudTenantContext): Promise<NormalizedCloudPaymentLink | null> | NormalizedCloudPaymentLink | null;
  listByTenant(tenant: CloudTenantContext, filters?: Record<string, unknown>): Promise<NormalizedCloudPaymentLink[]> | NormalizedCloudPaymentLink[];
}

export class InMemoryCloudPaymentLinkRepository implements CloudPaymentLinkRepository {
  private readonly records = new Map<string, NormalizedCloudPaymentLink>();
  private sequence = 0;

  save(link: CloudPaymentLink): NormalizedCloudPaymentLink {
    const normalized = normalizeCloudPaymentLink({
      ...link,
      id: link.id || `plink-${++this.sequence}`,
      createdAt: link.createdAt ?? new Date(),
      updatedAt: new Date(),
    });
    this.records.set(normalized.id, normalized);
    return normalized;
  }

  findByTenant(paymentLinkId: string, tenant: CloudTenantContext): NormalizedCloudPaymentLink | null {
    const record = this.records.get(paymentLinkId);
    return record?.tenant.organizationId === tenant.organizationId ? record : null;
  }

  listByTenant(tenant: CloudTenantContext): NormalizedCloudPaymentLink[] {
    return [...this.records.values()].filter((record) => record.tenant.organizationId === tenant.organizationId);
  }
}

export class RepositoryBackedPaymentLinkPort implements CloudPaymentLinkPort {
  constructor(private readonly repository: CloudPaymentLinkRepository) {}

  create(request: CloudPaymentLink): Promise<NormalizedCloudPaymentLink> | NormalizedCloudPaymentLink {
    return this.repository.save(request);
  }

  async get(paymentLinkId: string, tenant: CloudTenantContext): Promise<NormalizedCloudPaymentLink | null> {
    return this.repository.findByTenant(paymentLinkId, tenant);
  }

  async list(tenant: CloudTenantContext, filters?: Record<string, unknown>): Promise<NormalizedCloudPaymentLink[]> {
    return this.repository.listByTenant(tenant, filters);
  }

  async update(paymentLinkId: string, tenant: CloudTenantContext, updates: Partial<CloudPaymentLink>): Promise<NormalizedCloudPaymentLink> {
    const existing = await this.repository.findByTenant(paymentLinkId, tenant);
    if (!existing) throw new Error(`Payment link not found: ${paymentLinkId}`);
    return this.repository.save({ ...existing, ...updates, id: existing.id, tenant: existing.tenant });
  }
}
