/**
 * Order Summary Component (Left Column)
 * Shared by both CheckoutPage and OrderPage
 */
import React from 'react';

export interface OrderSummaryData {
  /** Product/Service title */
  title: string;
  /** Product/Service description */
  description?: string | null | undefined;
  /** Amount to pay */
  amount: string;
  /** Currency symbol (e.g., "USDC", "USDT") */
  currency: string;
  /** Networks description (e.g., "Ethereum, Polygon") */
  networksDescription?: string | undefined;
  /** Payment link share URL (optional, for Checkout page) */
  shareUrl?: string | null | undefined;
  /** Preview mode flag */
  isPreview?: boolean | undefined;
}

const sanitize = (value: string | null | undefined): string =>
  value == null ? '' : String(value);

const formatAmountDisplay = (amount: string, currency: string) =>
  `${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} ${currency}`;

/**
 * Order Summary component - displays product info, amount, and trust badges
 */
export function OrderSummary({ data }: { data: OrderSummaryData }) {
  const amountDisplay = formatAmountDisplay(data.amount, data.currency);

  return (
    <>
      {/* Mobile collapsible summary */}
      <button
        type="button"
        onClick={(e) => {
          const next = e.currentTarget.nextElementSibling as HTMLElement | null;
          next?.classList.toggle('hidden');
        }}
        className="lg:hidden w-full flex items-center justify-between p-4 bg-card border rounded-lg mb-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Order summary</span>
          <span className="text-lg font-bold" id="mobile-amount-display">{amountDisplay}</span>
        </div>
        <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Order summary content (Desktop: always visible, Mobile: collapsible) */}
      <div className="hidden lg:block bg-card border rounded-xl p-6 lg:p-8">

        {/* Status badge (preview mode only) */}
        {data.isPreview && (
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
              Preview Mode
            </span>
          </div>
        )}

        {/* Product info */}
        <div className="mb-6">
          <h1 id="summary-title" className="text-2xl font-bold mb-2">{sanitize(data.title)}</h1>
          {data.description && (
            <p id="summary-description" className="text-sm text-muted-foreground leading-relaxed">
              {sanitize(data.description)}
            </p>
          )}
        </div>

        {/* Amount section - prominent display */}
        <div className="py-6 border-t border-b">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm text-muted-foreground">Amount due</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl lg:text-5xl font-bold tracking-tight" id="amount-display">
              {amountDisplay}
            </span>
          </div>
        </div>

        {/* Additional details */}
        <div className="mt-6 space-y-4">
          {data.networksDescription && (
            <div className="flex gap-3">
              <div className="mt-0.5 text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                  <path d="M2 12h20"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium mb-1">Supported networks</div>
                <div className="text-sm text-muted-foreground">{sanitize(data.networksDescription)}</div>
              </div>
            </div>
          )}
          {data.shareUrl && (
            <div id="share-url-container" className="flex gap-3">
              <div className="mt-0.5 text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium mb-1">Payment link</div>
                  <span
                    id="share-url-copy-feedback"
                    className="text-xs text-primary opacity-0 transition-opacity duration-200"
                    aria-live="polite"
                  ></span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <a
                    id="share-url-link"
                    href={sanitize(data.shareUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline break-all flex-1"
                  >
                    {sanitize(data.shareUrl)}
                  </a>
                  <button
                    id="share-url-copy-button"
                    type="button"
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
                    aria-label="Copy payment link"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trust badges */}
        <div className="mt-8 pt-6 border-t space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span>Secure blockchain payment</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span>No hidden fees</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span>Instant confirmation</span>
          </div>
        </div>

      </div>
    </>
  );
}
