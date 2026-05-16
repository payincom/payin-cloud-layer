import { normalizeCloudTenantContext } from './context.js';

export type CloudProtocol = 'evm' | 'tron' | 'solana' | string;

export interface CloudPaymentScope {
  id: string;
  kind: 'tenant';
  label?: string;
}

export interface CloudProcessorOptions {
  /** Explicit tenant/organization scope for this Cloud adapter instance. */
  organizationId: string;
  /** Optional hosted tenant id when different from compatibility organization id. */
  tenantId?: string;
  /** Optional human-readable tenant label for logs/docs. */
  organizationLabel?: string;
}

export interface CloudProcessorBackend {
  start(): Promise<void>;
  stop(): Promise<void>;
  getEventBus(): unknown;
  createOrder(request: Record<string, unknown> & { organizationId: string }): Promise<any>;
  getOrder(orderId: string, organizationId: string): Promise<any | null>;
  bindDepositAddress(request: Record<string, unknown> & { organizationId: string }): Promise<any>;
  unbindDepositAddress(request: Record<string, unknown> & { organizationId: string }): Promise<void>;
  getUserDepositAddress(organizationId: string, depositReference: string, protocol: CloudProtocol): Promise<any>;
  listAddresses(params: Record<string, unknown> & { organizationId: string }): Promise<any>;
  getAddressPoolAvailability(organizationId: string, protocol: CloudProtocol): Promise<any>;
  addAddressesToPool(addresses: Array<Record<string, unknown> & { organizationId: string }>): Promise<void>;
  getTransfers(reference: { orderId?: string; depositReference?: string }, organizationId: string): Promise<any>;
  getTransferByTxHash(txHash: string, organizationId: string): Promise<any>;
  listOrders(filters: Record<string, unknown> & { organizationId: string }): Promise<any>;
  listTransfers(filters: Record<string, unknown> & { organizationId: string }): Promise<any>;
}

/**
 * PayIn Cloud adapter over PayIn shared processor compatibility APIs.
 *
 * This package stays standalone: it accepts a backend implementing the public
 * processor shape rather than importing PayIn Open internals. Production Cloud
 * wires this backend to the shared processor package; tests can provide fakes.
 */
export class CloudProcessor {
  readonly paymentScope: CloudPaymentScope;

  constructor(
    private readonly processor: CloudProcessorBackend,
    options: CloudProcessorOptions
  ) {
    const tenant = normalizeCloudTenantContext({
      organizationId: options.organizationId,
      tenantId: options.tenantId,
      label: options.organizationLabel,
    });
    this.paymentScope = {
      id: tenant.organizationId,
      kind: 'tenant',
      ...(tenant.label ? { label: tenant.label } : {}),
    };
  }

  get organizationId(): string {
    return this.paymentScope.id;
  }

  get rawProcessor(): CloudProcessorBackend {
    return this.processor;
  }

  start(): Promise<void> {
    return this.processor.start();
  }

  stop(): Promise<void> {
    return this.processor.stop();
  }

  getEventBus(): unknown {
    return this.processor.getEventBus();
  }

  createOrder(request: Record<string, unknown>): Promise<any> {
    return this.processor.createOrder({
      ...request,
      organizationId: this.organizationId,
    });
  }

  getOrder(orderId: string): Promise<any | null> {
    return this.processor.getOrder(orderId, this.organizationId);
  }

  bindDepositAddress(request: Record<string, unknown>): Promise<any> {
    return this.processor.bindDepositAddress({
      ...request,
      organizationId: this.organizationId,
    });
  }

  unbindDepositAddress(request: Record<string, unknown>): Promise<void> {
    return this.processor.unbindDepositAddress({
      ...request,
      organizationId: this.organizationId,
    });
  }

  getUserDepositAddress(depositReference: string, protocol: CloudProtocol = 'evm'): Promise<any> {
    return this.processor.getUserDepositAddress(this.organizationId, depositReference, protocol);
  }

  listAddresses(params: { protocol?: CloudProtocol; page?: number; pageSize?: number } = {}) {
    return this.processor.listAddresses({ organizationId: this.organizationId, ...params });
  }

  getAddressPoolAvailability(protocol: CloudProtocol = 'evm') {
    return this.processor.getAddressPoolAvailability(this.organizationId, protocol);
  }

  addAddressesToPool(addresses: Array<{
    address: string;
    protocol: CloudProtocol;
    masterPublicKey?: string | null;
    derivationIndex?: number | null;
  }>): Promise<void> {
    return this.processor.addAddressesToPool(addresses.map((address) => ({
      organizationId: this.organizationId,
      ...address,
    })));
  }

  getTransfers(reference: { orderId?: string; depositReference?: string }) {
    return this.processor.getTransfers(reference, this.organizationId);
  }

  getTransferByTxHash(txHash: string) {
    return this.processor.getTransferByTxHash(txHash, this.organizationId);
  }

  listOrders(filters: Record<string, unknown> = {}) {
    return this.processor.listOrders({ ...filters, organizationId: this.organizationId });
  }

  listTransfers(filters: Record<string, unknown> = {}) {
    return this.processor.listTransfers({ ...filters, organizationId: this.organizationId });
  }
}
