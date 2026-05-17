import { createCloudOrderStatusSummary, type CloudOrder, type CloudOrderStatusSummary } from './orders.js';
import { createPublicPaymentLinkView, type CloudPaymentLink, type PublicPaymentLinkView } from './payment-links.js';
import type { CloudAddressPoolEntry } from './address-pool.js';

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

export interface PublicDepositStatusView {
  address: string;
  protocol: string;
  state: string;
  depositReference?: string;
  orderId?: string;
  paymentUrl: string;
  metadata?: Record<string, unknown>;
}

export interface PublicChainView {
  id: string;
  name: string;
  status: 'enabled';
}

export interface PublicTokenView {
  symbol: string;
  status: 'enabled';
}

export interface PublicRuntimeDiscoveryView {
  chains: PublicChainView[];
  tokens: PublicTokenView[];
}

export interface PublicTransferStatusView {
  transactionHash: string;
  status: 'pending' | 'detected' | 'confirmed' | 'failed';
  orderId?: string;
  depositAddress?: string;
  chain: string;
  token: string;
  amount: string;
  confirmations: number;
  requiredConfirmations?: number | null;
  detectedAt?: Date;
  confirmedAt?: Date;
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

export function renderPublicOrderStatusHtml(view: PublicOrderStatusView): string {
  const title = `PayIn order ${view.orderReference ?? view.orderId}`;
  const progress = Math.round(view.paymentProgress);
  const statusClass = view.isFullyPaid ? 'success' : view.isPartiallyPaid ? 'partial' : 'pending';
  return htmlDocument(title, `
    <main class="payin-checkout payin-order-status ${statusClass}">
      <section class="card">
        <p class="eyebrow">Payment status</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="status-pill">${escapeHtml(view.status)}</p>
        <dl class="details">
          <div><dt>Required</dt><dd>${escapeHtml(view.requiredAmount)} ${escapeHtml(view.token)}</dd></div>
          <div><dt>Received</dt><dd>${escapeHtml(view.receivedAmount)} ${escapeHtml(view.token)}</dd></div>
          <div><dt>Remaining</dt><dd>${escapeHtml(view.remainingAmount)} ${escapeHtml(view.token)}</dd></div>
          <div><dt>Chain</dt><dd>${escapeHtml(view.chain)}</dd></div>
          ${view.address ? `<div><dt>Address</dt><dd class="mono">${escapeHtml(view.address)}</dd></div>` : ''}
          ${view.transactionHash ? `<div><dt>Transaction</dt><dd class="mono">${escapeHtml(view.transactionHash)}</dd></div>` : ''}
        </dl>
        <div class="progress" aria-label="Payment progress"><span style="width:${progress}%"></span></div>
        <p class="muted">${progress}% paid · ${view.currentConfirmations}${view.requiredConfirmations ? `/${view.requiredConfirmations}` : ''} confirmations</p>
        ${view.redirectUrl && view.isFullyPaid ? `<p><a class="button" href="${escapeAttribute(view.redirectUrl)}">Continue</a></p>` : ''}
      </section>
      <script type="application/json" id="payin-order-status-data">${escapeHtml(JSON.stringify(toLegacyPublicOrderStatusResponse(view)))}</script>
    </main>
  `);
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

export function renderPublicPaymentLinkCheckoutHtml(view: PublicPaymentLinkCheckoutView): string {
  const title = view.title || 'Pay with PayIn';
  const inventory = view.availableInventory == null ? '' : `<p class="muted">${view.availableInventory} available</p>`;
  const chainOptions = view.chainOptions.map((chain) => `<li>${escapeHtml(chain)}</li>`).join('');
  return htmlDocument(title, `
    <main class="payin-checkout payin-payment-link">
      <section class="card">
        <p class="eyebrow">PayIn checkout</p>
        <h1>${escapeHtml(title)}</h1>
        ${view.description ? `<p class="description">${escapeHtml(view.description)}</p>` : ''}
        <p class="amount">${escapeHtml(view.amount)} <span>${escapeHtml(view.currency)}</span></p>
        ${inventory}
        <div class="chains"><h2>Accepted networks</h2><ul>${chainOptions}</ul></div>
        <p><a class="button" href="${escapeAttribute(`${view.orderBaseUrl}?paymentLink=${encodeURIComponent(view.id)}`)}">Create payment order</a></p>
        <p class="muted">Share URL: <span class="mono">${escapeHtml(view.shareUrl)}</span></p>
      </section>
      <script type="application/json" id="payin-checkout-data">${escapeHtml(JSON.stringify({ success: true, data: view }))}</script>
    </main>
  `);
}

export function createPublicDepositStatusView(entry: CloudAddressPoolEntry, options: { requestOrigin: string }): PublicDepositStatusView {
  const requestOrigin = options.requestOrigin.replace(/\/+$/, '');
  return {
    address: entry.address,
    protocol: entry.protocol,
    state: entry.state,
    depositReference: entry.depositReference,
    orderId: entry.orderId,
    paymentUrl: `${requestOrigin}/pay/deposit/${encodeURIComponent(entry.address)}`,
    metadata: entry.metadata,
  };
}

export function renderPublicDepositStatusHtml(view: PublicDepositStatusView): string {
  const title = `Deposit ${view.depositReference ?? view.address}`;
  return htmlDocument(title, `
    <main class="payin-checkout payin-deposit-status">
      <section class="card">
        <p class="eyebrow">Deposit payment</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="status-pill">${escapeHtml(view.state)}</p>
        <dl class="details">
          <div><dt>Address</dt><dd class="mono">${escapeHtml(view.address)}</dd></div>
          <div><dt>Protocol</dt><dd>${escapeHtml(view.protocol)}</dd></div>
          ${view.depositReference ? `<div><dt>Reference</dt><dd>${escapeHtml(view.depositReference)}</dd></div>` : ''}
          ${view.orderId ? `<div><dt>Order</dt><dd>${escapeHtml(view.orderId)}</dd></div>` : ''}
        </dl>
        <p class="muted">Send only supported assets on the selected network to this address.</p>
      </section>
      <script type="application/json" id="payin-deposit-status-data">${escapeHtml(JSON.stringify({ success: true, data: view }))}</script>
    </main>
  `);
}

export function createPublicRuntimeDiscoveryView(input: { chains: string[]; tokens: string[] }): PublicRuntimeDiscoveryView {
  return {
    chains: input.chains.map((id) => ({ id, name: humanizeIdentifier(id), status: 'enabled' as const })),
    tokens: input.tokens.map((symbol) => ({ symbol, status: 'enabled' as const })),
  };
}

export function createPublicTransferStatusView(input: PublicTransferStatusView): PublicTransferStatusView {
  const transactionHash = input.transactionHash.trim();
  if (!transactionHash) throw new Error('transactionHash is required');
  return {
    ...input,
    transactionHash,
    confirmations: Math.max(0, Math.floor(input.confirmations)),
  };
}

function humanizeIdentifier(value: string): string {
  return value.split(/[-_]/g).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || value;
}

function htmlDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #e2e8f0; }
    .payin-checkout { width: min(100%, 760px); padding: 32px 20px; box-sizing: border-box; }
    .card { background: #111827; border: 1px solid #334155; border-radius: 24px; padding: 32px; box-shadow: 0 24px 80px rgba(0,0,0,.35); }
    .eyebrow { color: #38bdf8; text-transform: uppercase; letter-spacing: .16em; font-size: 12px; font-weight: 700; margin: 0 0 8px; }
    h1 { margin: 0 0 16px; font-size: clamp(28px, 5vw, 48px); line-height: 1.05; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .12em; color: #94a3b8; }
    .amount { font-size: clamp(36px, 7vw, 64px); font-weight: 800; margin: 24px 0 8px; }
    .amount span, .muted { color: #94a3b8; }
    .button { display: inline-block; margin-top: 24px; padding: 14px 20px; border-radius: 999px; background: #38bdf8; color: #082f49; text-decoration: none; font-weight: 800; }
    .details { display: grid; gap: 12px; margin: 24px 0; }
    .details div { display: grid; gap: 4px; padding: 12px 0; border-bottom: 1px solid #1f2937; }
    dt { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .status-pill { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #1e293b; color: #bae6fd; font-weight: 700; }
    .progress { height: 12px; border-radius: 999px; background: #1f2937; overflow: hidden; }
    .progress span { display: block; height: 100%; background: linear-gradient(90deg, #38bdf8, #22c55e); }
    ul { padding-left: 20px; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function calculateCurrentConfirmations(transfer?: PublicOrderStatusTransferInput): number {
  if (!transfer) return 0;
  if (transfer.confirmedAt && transfer.detectedBlockNumber != null && transfer.confirmedBlockNumber != null) {
    return Math.max(0, transfer.confirmedBlockNumber - transfer.detectedBlockNumber + 1);
  }
  if (transfer.detectedBlockNumber != null) return 1;
  return 0;
}
