import { createCloudOrderDraft, normalizeCloudOrder, type CloudOrder, type CloudOrderDraftInput, type NormalizedCloudOrder } from '../../orders.js';
import type { CloudTenantContext } from '../../context.js';
import type { CloudOrderPort } from '../../ports.js';

export interface CloudOrderRepository {
  save(order: CloudOrder): Promise<NormalizedCloudOrder> | NormalizedCloudOrder;
  findByTenant(orderId: string, tenant: CloudTenantContext): Promise<NormalizedCloudOrder | null> | NormalizedCloudOrder | null;
  listByTenant(tenant: CloudTenantContext, filters?: Record<string, unknown>): Promise<NormalizedCloudOrder[]> | NormalizedCloudOrder[];
}

export class InMemoryCloudOrderRepository implements CloudOrderRepository {
  private readonly records = new Map<string, NormalizedCloudOrder>();
  private sequence = 0;

  save(order: CloudOrder): NormalizedCloudOrder {
    const normalized = normalizeCloudOrder({
      ...order,
      id: order.id || `order-${++this.sequence}`,
      createdAt: order.createdAt ?? new Date(),
      updatedAt: new Date(),
    });
    this.records.set(normalized.id, normalized);
    return normalized;
  }

  findByTenant(orderId: string, tenant: CloudTenantContext): NormalizedCloudOrder | null {
    const record = this.records.get(orderId);
    return record?.tenant.organizationId === tenant.organizationId ? record : null;
  }

  listByTenant(tenant: CloudTenantContext, filters: Record<string, unknown> = {}): NormalizedCloudOrder[] {
    return [...this.records.values()].filter((record) =>
      record.tenant.organizationId === tenant.organizationId
      && (!filters.status || record.status === filters.status)
    );
  }
}

export class RepositoryBackedOrderPort implements CloudOrderPort {
  constructor(private readonly repository: CloudOrderRepository) {}

  async create(request: CloudOrderDraftInput): Promise<NormalizedCloudOrder> {
    const draft = createCloudOrderDraft(request);
    return this.repository.save({
      ...draft,
      id: draft.id ?? '',
      tenant: draft.tenant,
      confirmedReceived: draft.confirmedReceived ?? '0',
    });
  }

  async get(orderId: string, tenant: CloudTenantContext): Promise<NormalizedCloudOrder | null> {
    return this.repository.findByTenant(orderId, tenant);
  }

  async list(tenant: CloudTenantContext, filters?: Record<string, unknown>): Promise<NormalizedCloudOrder[]> {
    return this.repository.listByTenant(tenant, filters);
  }
}
