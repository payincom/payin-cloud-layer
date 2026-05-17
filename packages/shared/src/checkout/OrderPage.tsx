/**
 * Order Payment Page React Component
 * Shares the same layout as CheckoutPage for visual consistency
 */
import React from 'react';
import { PaymentLayout } from './components/PaymentLayout.js';
import { OrderSummary } from './components/OrderSummary.js';

export interface OrderPageData {
  /** Order ID */
  id: string;
  /** Order reference */
  orderReference: string;
  /** Product/Service title */
  title: string;
  /** Product/Service description */
  description?: string | null;
  /** Payment address */
  paymentAddress: string;
  /** Amount to pay */
  amount: string;
  /** Currency symbol */
  currency: string;
  /** Chain ID */
  chainId: string;
  /** Chain name (formatted, e.g., "Ethereum Sepolia") */
  chainName: string;
  /** Order status */
  status: 'pending' | 'completed' | 'expired';
  /** QR code data URL */
  qrCodeDataUrl?: string;
  /** Redirect URL (for completed/expired orders) */
  redirectUrl?: string | null;
  /** Completed timestamp */
  completedAt?: string | null;
}

export interface OrderPageRenderOptions {
  /** Request origin (for asset URLs) */
  requestOrigin: string;
  /** API base URL */
  apiBaseUrl: string;
}

export interface OrderPageProps {
  data: OrderPageData;
  options: OrderPageRenderOptions;
}

const sanitize = (value: string | null | undefined): string =>
  value == null ? '' : String(value);

/**
 * Order Payment Page component
 * Uses the same layout as CheckoutPage for smooth transition
 */
export function OrderPage({ data, options }: OrderPageProps) {
  // Prepare order summary data (same structure as CheckoutPage)
  const orderSummaryData = {
    title: data.title,
    description: data.description,
    amount: data.amount,
    currency: data.currency,
    networksDescription: data.chainName,
    shareUrl: null, // Orders don't have share URLs
    isPreview: false,
  };

  // Render different right column content based on order status
  const rightColumn = data.status === 'pending' ? (
    // Pending order: Show payment information
    <div className="bg-card border rounded-xl p-6 lg:p-8">
      <h2 className="text-xl font-semibold mb-6">Scan to Pay</h2>

      {/* QR Code */}
      <div className="flex justify-center mb-6">
        <div className="bg-white p-4 rounded-lg">
          <img
            src={data.qrCodeDataUrl}
            alt="Payment QR Code"
            className="w-64 h-64"
          />
        </div>
      </div>

      {/* Payment Address */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Payment Address</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-4 py-3 bg-background border border-input rounded-lg text-sm font-mono break-all">
            {sanitize(data.paymentAddress)}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(data.paymentAddress)}
            className="flex-shrink-0 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            title="Copy address"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Send exactly <span className="font-semibold">{data.amount} {data.currency}</span> to this address on <span className="font-semibold">{data.chainName}</span>
        </p>
      </div>

      {/* Payment Status */}
      <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-500">Awaiting payment</p>
            <p className="text-xs text-muted-foreground mt-1">
              We're monitoring the blockchain for your transaction
            </p>
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="mt-6 pt-6 border-t space-y-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">⚠️ Important:</span> Only send {data.currency} on the {data.chainName} network. Sending other tokens or using a different network will result in permanent loss of funds.
        </p>
        <p className="text-xs text-muted-foreground">
          Payment confirmation typically takes a few minutes after your transaction is broadcast to the blockchain.
        </p>
      </div>
    </div>
  ) : (
    // Completed/Expired order: Show status message
    <div className="bg-card border rounded-xl p-6 lg:p-8">
      <div className="text-center space-y-6">
        {/* Status Icon and Message */}
        {data.status === 'completed' ? (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-500 mb-2">Payment Completed!</h2>
              <p className="text-muted-foreground">
                Your payment has been successfully confirmed on the blockchain.
              </p>
              {data.completedAt && (
                <p className="text-sm text-muted-foreground mt-2">
                  Completed at {new Date(data.completedAt).toLocaleString()}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-destructive mb-2">Payment Expired</h2>
              <p className="text-muted-foreground">
                This payment link has expired. Please contact the merchant for a new payment link.
              </p>
            </div>
          </>
        )}

        {/* Redirect Button */}
        {data.redirectUrl && (
          <div className="pt-6">
            <a
              href={data.redirectUrl}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              Return to {data.status === 'completed' ? 'Merchant' : 'Store'}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/>
                <path d="m12 5 7 7-7 7"/>
              </svg>
            </a>
          </div>
        )}

        {/* Order Reference */}
        <div className="pt-6 border-t">
          <p className="text-xs text-muted-foreground">
            Order Reference: <span className="font-mono">{sanitize(data.orderReference)}</span>
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <PaymentLayout
      theme="dark"
      title={`${sanitize(data.title)} · PayIn Order`}
      metaDescription={`Complete your payment for ${sanitize(data.title)}`}
      stylesheetUrl={`${options.apiBaseUrl}/dist/assets/style.css`}
      leftColumn={<OrderSummary data={orderSummaryData} />}
      rightColumn={rightColumn}
    />
  );
}
