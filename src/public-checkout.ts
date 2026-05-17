import { createCloudOrderStatusSummary, type CloudOrder, type CloudOrderStatusSummary } from './orders.js';
import { createPublicPaymentLinkView, type CloudPaymentLink, type PublicPaymentLinkView } from './payment-links.js';

export interface PublicOrderStatusTransferInput {
  transactionHash?: string | null;
  status?: string | null;
  detectedBlockNumber?: number | null;
  confirmedBlockNumber?: number | null;
  confirmedAt?: Date | null;
}

export interface PublicOrderStatusInput {
  order: CloudOrder;
  transfers?: PublicOrderStatusTransferInput[];
  requiredConfirmations?: number | null;
  redirectUrl?: string | null;
}

export interface PublicOrderStatusView extends CloudOrderStatusSummary {
  orderId: string;
  token: string;
  chain: string;
  address?: string;
  requiredConfirmations?: number | null;
  currentConfirmations: number;
  transactionHash: string | null;
  transferStatus: string | null;
  completedAt?: Date;
  createdAt?: Date;
  requiredAmount: string;
  receivedAmount: string;
  paymentProgress: number;
  isPartiallyPaid: boolean;
  isFullyPaid: boolean;
  transferCount: number;
  redirectUrl?: string | null;
}

export interface PublicPaymentLinkCheckoutOptions {
  requestOrigin: string;
  apiBaseUrl?: string;
  orderBaseUrl?: string;
}

export interface PublicPaymentLinkCheckoutView extends PublicPaymentLinkView {
  requestOrigin: string;
  apiBaseUrl: string;
  orderBaseUrl: string;
  shareUrl: string;
}

export function createPublicOrderStatusView(input: PublicOrderStatusInput): PublicOrderStatusView {
  const summary = createCloudOrderStatusSummary(input.order);
  const transfers = input.transfers ?? [];
  const latestTransfer = transfers[0];
  const receivedAmount = summary.confirmedReceived;
  const requiredAmount = summary.amount;
  const received = Number(receivedAmount);
  const required = Number(requiredAmount);
  const paymentProgress = required > 0 ? Math.min((received / required) * 100, 100) : 0;

  return {
    ...summary,
    orderId: summary.id,
    token: summary.currency,
    chain: summary.chainId,
    address: summary.paymentAddress,
    requiredConfirmations: input.requiredConfirmations,
    currentConfirmations: calculateCurrentConfirmations(latestTransfer),
    transactionHash: latestTransfer?.transactionHash ?? null,
    transferStatus: latestTransfer?.status ?? null,
    completedAt: input.order.updatedAt,
    createdAt: input.order.createdAt,
    requiredAmount,
    receivedAmount,
    paymentProgress,
    isPartiallyPaid: received > 0 && received < required,
    isFullyPaid: received >= required,
    transferCount: transfers.length,
    redirectUrl: input.redirectUrl ?? null,
  };
}

export function toLegacyPublicOrderStatusResponse(view: PublicOrderStatusView): { success: true; data: PublicOrderStatusView } {
  return { success: true, data: view };
}

export function createPublicPaymentLinkCheckoutView(link: CloudPaymentLink, options: PublicPaymentLinkCheckoutOptions): PublicPaymentLinkCheckoutView {
  const view = createPublicPaymentLinkView(link);
  const requestOrigin = options.requestOrigin.replace(/\/+$/, '');
  const apiBaseUrl = (options.apiBaseUrl ?? requestOrigin).replace(/\/+$/, '');
  const orderBaseUrl = (options.orderBaseUrl ?? `${requestOrigin}/pay/order`).replace(/\/+$/, '');
  return {
    ...view,
    requestOrigin,
    apiBaseUrl,
    orderBaseUrl,
    shareUrl: `${requestOrigin}/checkout/${encodeURIComponent(view.slug)}`,
  };
}

function calculateCurrentConfirmations(transfer?: PublicOrderStatusTransferInput): number {
  if (!transfer) return 0;
  if (transfer.confirmedAt && transfer.detectedBlockNumber != null && transfer.confirmedBlockNumber != null) {
    return Math.max(0, transfer.confirmedBlockNumber - transfer.detectedBlockNumber + 1);
  }
  if (transfer.detectedBlockNumber != null) return 1;
  return 0;
}
