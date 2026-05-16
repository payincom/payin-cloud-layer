import { normalizeCloudTenantContext, type CloudTenantContext, type NormalizedCloudTenantContext } from './context.js';

export type CloudOrderStatus = 'pending' | 'completed' | 'expired' | 'failed' | 'cancelled';

export interface CloudOrderDraftInput {
  tenant: CloudTenantContext;
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  metadata?: Record<string, unknown>;
}

export interface CloudOrder {
  id: string;
  tenant: CloudTenantContext | NormalizedCloudTenantContext;
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  status: CloudOrderStatus;
  paymentAddress?: string;
  confirmedReceived?: string;
  completionTxHash?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CloudOrderDraft extends Omit<CloudOrder, 'id' | 'tenant'> {
  tenant: NormalizedCloudTenantContext;
  id?: string;
}

export interface NormalizedCloudOrder extends Omit<CloudOrder, 'tenant' | 'confirmedReceived'> {
  tenant: NormalizedCloudTenantContext;
  confirmedReceived: string;
}

export interface CloudOrderStatusSummary {
  id: string;
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  status: CloudOrderStatus;
  paymentAddress?: string;
  confirmedReceived: string;
  remainingAmount: string;
}

export class CloudOrderValidationError extends Error {
  readonly code = 'CLOUD_ORDER_VALIDATION_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'CloudOrderValidationError';
  }
}

export class CloudOrderStateError extends Error {
  readonly code = 'CLOUD_ORDER_STATE_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'CloudOrderStateError';
  }
}

export function createCloudOrderDraft(input: CloudOrderDraftInput): CloudOrderDraft {
  return {
    tenant: normalizeCloudTenantContext(input.tenant),
    orderReference: requireText(input.orderReference, 'orderReference'),
    amount: normalizePositiveDecimal(input.amount, 'Order amount'),
    currency: normalizeCurrency(input.currency, 'Order currency'),
    chainId: requireText(input.chainId, 'chainId'),
    status: 'pending',
    confirmedReceived: '0',
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function normalizeCloudOrder(order: CloudOrder): NormalizedCloudOrder {
  return {
    ...order,
    tenant: normalizeCloudTenantContext(order.tenant),
    orderReference: requireText(order.orderReference, 'orderReference'),
    amount: normalizePositiveDecimal(order.amount, 'Order amount'),
    currency: normalizeCurrency(order.currency, 'Order currency'),
    chainId: requireText(order.chainId, 'chainId'),
    confirmedReceived: normalizeDecimal(order.confirmedReceived ?? '0', 'confirmedReceived'),
  };
}

export function createCloudPaymentPageUrl(order: CloudOrder, baseUrl: string): string {
  const normalized = normalizeCloudOrder(order);
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/pay/order/${encodeURIComponent(normalized.id)}`;
}

export function createCloudOrderStatusSummary(order: CloudOrder): CloudOrderStatusSummary {
  const normalized = normalizeCloudOrder(order);
  return {
    id: normalized.id,
    orderReference: normalized.orderReference,
    amount: normalized.amount,
    currency: normalized.currency,
    chainId: normalized.chainId,
    status: normalized.status,
    paymentAddress: normalized.paymentAddress,
    confirmedReceived: normalized.confirmedReceived,
    remainingAmount: subtractDecimal(normalized.amount, normalized.confirmedReceived),
  };
}

export function markCloudOrderCompleted(
  order: CloudOrder,
  input: { confirmedReceived: string; txHash?: string }
): NormalizedCloudOrder {
  const normalized = normalizeCloudOrder(order);
  if (normalized.status !== 'pending') {
    throw new CloudOrderStateError('Only pending orders can be completed');
  }
  const confirmedReceived = normalizeDecimal(input.confirmedReceived, 'confirmedReceived');
  if (compareDecimal(confirmedReceived, normalized.amount) < 0) {
    throw new CloudOrderStateError('Confirmed amount is below order amount');
  }
  return {
    ...normalized,
    status: 'completed',
    confirmedReceived,
    ...(input.txHash ? { completionTxHash: input.txHash } : {}),
  };
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new CloudOrderValidationError(`${field} is required`);
  return normalized;
}

function normalizeCurrency(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[A-Z][A-Z0-9]{1,15}$/.test(normalized)) {
    throw new CloudOrderValidationError(`${label} must be an uppercase symbol`);
  }
  return normalized;
}

function normalizePositiveDecimal(value: string, label: string): string {
  const normalized = normalizeDecimal(value, label);
  if (Number(normalized) <= 0) throw new CloudOrderValidationError(`${label} must be a positive decimal string`);
  return normalized;
}

function normalizeDecimal(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new CloudOrderValidationError(`${label} must be a decimal string`);
  }
  return normalized;
}

function compareDecimal(left: string, right: string): number {
  const l = Number(left);
  const r = Number(right);
  return l === r ? 0 : l > r ? 1 : -1;
}

function subtractDecimal(left: string, right: string): string {
  const scale = Math.max(decimalPlaces(left), decimalPlaces(right));
  const factor = 10 ** scale;
  const result = Math.max(0, Math.round(Number(left) * factor) - Math.round(Number(right) * factor));
  return (result / factor).toFixed(scale);
}

function decimalPlaces(value: string): number {
  return value.includes('.') ? value.split('.')[1].length : 0;
}
