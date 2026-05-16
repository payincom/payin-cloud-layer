import {
  Processor,
  tenantPaymentScope,
  type PaymentScope,
  type ProcessorConfig,
} from '@payin/processor';
import { normalizeCloudTenantContext } from './context.js';
import type { ConfigProvider } from '@payin/shared';
import type { CreateOrderRequest, CreateOrderResponse } from '@payin/processor';
import type { BindAddressRequest, BindAddressResponse, UnbindAddressRequest } from '@payin/processor';

export type CloudProtocol = 'evm' | 'tron' | 'solana';

export interface CloudProcessorOptions {
  /** Explicit tenant/organization scope for this Cloud adapter instance. */
  organizationId: string;
  /** Optional hosted tenant id when different from compatibility organization id. */
  tenantId?: string;
  /** Optional human-readable tenant label for logs/docs. */
  organizationLabel?: string;
}

/**
 * PayIn Cloud adapter over PayIn Open's shared processor compatibility layer.
 *
 * This belongs in the Cloud overlay layer, not in payin-open. Cloud keeps
 * explicit tenant context at its boundary; Open uses OpenProcessor instead.
 */
export class CloudProcessor {
  readonly paymentScope: PaymentScope;

  constructor(
    private readonly processor: Processor,
    options: CloudProcessorOptions
  ) {
    const tenant = normalizeCloudTenantContext({
      organizationId: options.organizationId,
      tenantId: options.tenantId,
      label: options.organizationLabel,
    });
    this.paymentScope = tenantPaymentScope(tenant.organizationId, tenant.label);
  }

  static async create(
    config: ProcessorConfig = {},
    configFile?: string,
    configProvider?: ConfigProvider,
    options?: CloudProcessorOptions
  ): Promise<CloudProcessor> {
    if (!options?.organizationId) {
      throw new Error('CloudProcessor requires an explicit organizationId');
    }
    const processor = await Processor.create(config, configFile, configProvider);
    return new CloudProcessor(processor, options);
  }

  get organizationId(): string {
    return this.paymentScope.id;
  }

  get rawProcessor(): Processor {
    return this.processor;
  }

  start(): Promise<void> {
    return this.processor.start();
  }

  stop(): Promise<void> {
    return this.processor.stop();
  }

  getEventBus(): ReturnType<Processor['getEventBus']> {
    return this.processor.getEventBus();
  }

  createOrder(request: Omit<CreateOrderRequest, 'organizationId'>): Promise<CreateOrderResponse> {
    return this.processor.createOrder({
      ...request,
      organizationId: this.organizationId,
    });
  }

  getOrder(orderId: string): Promise<any | null> {
    return this.processor.getOrder(orderId, this.organizationId);
  }

  bindDepositAddress(request: Omit<BindAddressRequest, 'organizationId'>): Promise<BindAddressResponse> {
    return this.processor.bindDepositAddress({
      ...request,
      organizationId: this.organizationId,
    });
  }

  unbindDepositAddress(request: Omit<UnbindAddressRequest, 'organizationId'>): Promise<void> {
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

  listOrders(filters: Parameters<Processor['listOrders']>[0] = {}) {
    return this.processor.listOrders({ ...filters, organizationId: this.organizationId });
  }

  listTransfers(filters: Parameters<Processor['listTransfers']>[0] = {}) {
    return this.processor.listTransfers({ ...filters, organizationId: this.organizationId });
  }
}
