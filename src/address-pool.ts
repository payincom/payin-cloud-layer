import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';

export type CloudAddressProtocol = 'evm' | 'tron' | 'solana' | string;
export type CloudAddressPoolState = 'idle' | 'reserved' | 'bound';

export interface CloudAddressPoolEntry {
  tenant: CloudTenantContext | NormalizedCloudTenantContext;
  address: string;
  protocol: CloudAddressProtocol;
  state: CloudAddressPoolState;
  derivationIndex?: number | null;
  masterPublicKeyRef?: string;
  depositReference?: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedCloudAddressPoolEntry extends Omit<CloudAddressPoolEntry, 'tenant'> {
  tenant: NormalizedCloudTenantContext;
}

export interface AddressPoolProtocolSummary {
  protocol: CloudAddressProtocol;
  total: number;
  available: number;
  bound: number;
  reserved: number;
}

export interface AddressPoolSummary {
  tenant: NormalizedCloudTenantContext;
  totalAddresses: number;
  hasAddresses: boolean;
  protocols: AddressPoolProtocolSummary[];
}

export class AddressPoolValidationError extends Error {
  readonly code = 'ADDRESS_POOL_VALIDATION_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'AddressPoolValidationError';
  }
}

export class AddressPoolLimitExceededError extends Error {
  readonly code = 'ADDRESS_POOL_LIMIT_EXCEEDED';

  constructor(message = 'Address pool limit exceeded') {
    super(message);
    this.name = 'AddressPoolLimitExceededError';
  }
}

export class AddressPoolStateError extends Error {
  readonly code = 'ADDRESS_POOL_STATE_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'AddressPoolStateError';
  }
}

export function normalizeCloudAddressPoolEntry(input: CloudAddressPoolEntry): NormalizedCloudAddressPoolEntry {
  const address = input.address.trim();
  if (!address) throw new AddressPoolValidationError('Address is required');
  const protocol = input.protocol.trim();
  if (!protocol) throw new AddressPoolValidationError('Protocol is required');
  if (input.masterPublicKeyRef && !input.masterPublicKeyRef.startsWith('secret://')) {
    throw new AddressPoolValidationError('masterPublicKeyRef must be a secret:// reference');
  }
  if (input.derivationIndex != null && (!Number.isInteger(input.derivationIndex) || input.derivationIndex < 0)) {
    throw new AddressPoolValidationError('derivationIndex must be a non-negative integer');
  }

  return {
    ...input,
    tenant: normalizeCloudTenantContext(input.tenant),
    address,
    protocol,
  };
}

export function importCloudAddressPoolDraft(input: {
  tenant: CloudTenantContext;
  protocol: CloudAddressProtocol;
  addresses: Array<{ address: string; derivationIndex?: number | null }>;
  masterPublicKeyRef?: string;
  existingCount?: number;
  limit?: number | null;
}): NormalizedCloudAddressPoolEntry[] {
  const existingCount = input.existingCount ?? 0;
  if (input.limit != null && existingCount + input.addresses.length > input.limit) {
    throw new AddressPoolLimitExceededError();
  }

  return input.addresses.map((address) => normalizeCloudAddressPoolEntry({
    tenant: input.tenant,
    protocol: input.protocol,
    state: 'idle',
    address: address.address,
    derivationIndex: address.derivationIndex,
    masterPublicKeyRef: input.masterPublicKeyRef,
  }));
}

export function createAddressPoolSummary(
  entries: CloudAddressPoolEntry[],
  tenant: CloudTenantContext
): AddressPoolSummary {
  const normalizedTenant = normalizeCloudTenantContext(tenant);
  const protocols = new Map<string, AddressPoolProtocolSummary>();

  for (const entry of entries.map(normalizeCloudAddressPoolEntry)) {
    if (entry.tenant.organizationId !== normalizedTenant.organizationId) {
      throw new AddressPoolValidationError('Address pool summary cannot include another tenant');
    }
    const current = protocols.get(entry.protocol) ?? {
      protocol: entry.protocol,
      total: 0,
      available: 0,
      bound: 0,
      reserved: 0,
    };
    current.total += 1;
    if (entry.state === 'idle') current.available += 1;
    if (entry.state === 'bound') current.bound += 1;
    if (entry.state === 'reserved') current.reserved += 1;
    protocols.set(entry.protocol, current);
  }

  const protocolSummaries = [...protocols.values()].sort((a, b) => a.protocol.localeCompare(b.protocol));
  return {
    tenant: normalizedTenant,
    totalAddresses: entries.length,
    hasAddresses: entries.length > 0,
    protocols: protocolSummaries,
  };
}

export function bindCloudDepositAddress(
  entry: CloudAddressPoolEntry,
  input: { depositReference: string; orderId?: string }
): NormalizedCloudAddressPoolEntry {
  const normalized = normalizeCloudAddressPoolEntry(entry);
  if (normalized.state !== 'idle') {
    throw new AddressPoolStateError('Only idle addresses can be bound');
  }
  const depositReference = input.depositReference.trim();
  if (!depositReference) throw new AddressPoolValidationError('depositReference is required');
  return {
    ...normalized,
    state: 'bound',
    depositReference,
    ...(input.orderId ? { orderId: input.orderId.trim() } : {}),
  };
}

export function releaseCloudDepositAddress(entry: CloudAddressPoolEntry): NormalizedCloudAddressPoolEntry {
  const normalized = normalizeCloudAddressPoolEntry(entry);
  if (normalized.state !== 'bound' && normalized.state !== 'reserved') {
    throw new AddressPoolStateError('Only bound or reserved addresses can be released');
  }
  const { depositReference, orderId, ...rest } = normalized;
  void depositReference;
  void orderId;
  return {
    ...rest,
    state: 'idle',
  };
}
