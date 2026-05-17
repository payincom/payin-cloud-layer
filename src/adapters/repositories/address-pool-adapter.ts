import {
  bindCloudDepositAddress,
  createAddressPoolSummary,
  importCloudAddressPoolDraft,
  normalizeCloudAddressPoolEntry,
  type AddressPoolSummary,
  type CloudAddressPoolEntry,
  type NormalizedCloudAddressPoolEntry,
} from '../../address-pool.js';
import type { CloudTenantContext } from '../../context.js';
import type { CloudAddressPoolPort } from '../../ports.js';

export interface CloudAddressPoolRepository {
  import(entries: CloudAddressPoolEntry[]): Promise<NormalizedCloudAddressPoolEntry[]> | NormalizedCloudAddressPoolEntry[];
  listByTenant(tenant: CloudTenantContext): Promise<NormalizedCloudAddressPoolEntry[]> | NormalizedCloudAddressPoolEntry[];
  replace(entry: CloudAddressPoolEntry): Promise<NormalizedCloudAddressPoolEntry> | NormalizedCloudAddressPoolEntry;
}

export class InMemoryCloudAddressPoolRepository implements CloudAddressPoolRepository {
  private readonly records: NormalizedCloudAddressPoolEntry[] = [];

  import(entries: CloudAddressPoolEntry[]): NormalizedCloudAddressPoolEntry[] {
    const normalized = entries.map(normalizeCloudAddressPoolEntry);
    this.records.push(...normalized);
    return normalized;
  }

  listByTenant(tenant: CloudTenantContext): NormalizedCloudAddressPoolEntry[] {
    return this.records.filter((record) => record.tenant.organizationId === tenant.organizationId);
  }

  replace(entry: CloudAddressPoolEntry): NormalizedCloudAddressPoolEntry {
    const normalized = normalizeCloudAddressPoolEntry(entry);
    const index = this.records.findIndex((record) =>
      record.tenant.organizationId === normalized.tenant.organizationId && record.address === normalized.address
    );
    if (index === -1) throw new Error(`Address not found: ${normalized.address}`);
    this.records[index] = normalized;
    return normalized;
  }
}

export class RepositoryBackedAddressPoolPort implements CloudAddressPoolPort {
  constructor(private readonly repository: CloudAddressPoolRepository) {}

  async import(request: {
    tenant: CloudTenantContext;
    protocol: string;
    addresses: Array<{ address: string; derivationIndex?: number | null }>;
    masterPublicKeyRef?: string;
    limit?: number | null;
  }): Promise<NormalizedCloudAddressPoolEntry[]> {
    const existingCount = (await this.repository.listByTenant(request.tenant)).length;
    const draft = importCloudAddressPoolDraft({ ...request, existingCount });
    return this.repository.import(draft);
  }

  async summary(tenant: CloudTenantContext): Promise<AddressPoolSummary> {
    return createAddressPoolSummary(await this.repository.listByTenant(tenant), tenant);
  }

  async list(tenant: CloudTenantContext, filters: Record<string, unknown> = {}): Promise<NormalizedCloudAddressPoolEntry[]> {
    return (await this.repository.listByTenant(tenant)).filter((entry) =>
      (!filters.protocol || entry.protocol === filters.protocol)
      && (!filters.state || entry.state === filters.state)
    );
  }

  async bindFirstIdle(tenant: CloudTenantContext, depositReference: string, orderId: string): Promise<NormalizedCloudAddressPoolEntry> {
    const entry = (await this.repository.listByTenant(tenant)).find((candidate) => candidate.state === 'idle');
    if (!entry) throw new Error('No idle address is available');
    return this.repository.replace(bindCloudDepositAddress(entry, { depositReference, orderId }));
  }
}
