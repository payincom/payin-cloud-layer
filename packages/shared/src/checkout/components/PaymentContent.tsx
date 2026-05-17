/**
 * Payment Content Layout (Client-side version without HTML wrapper)
 * Used by client-side React apps for consistent layout
 */
import React from 'react';

export interface PaymentContentProps {
  /** Left column content (Order Summary) */
  leftColumn: React.ReactNode;
  /** Right column content (Action Area - Payment, Wallet, etc.) */
  rightColumn: React.ReactNode;
  /** Optional footer content */
  footer?: React.ReactNode;
}

/**
 * Payment content layout for client-side apps
 * Provides consistent two-column layout (without HTML document wrapper)
 */
export function PaymentContent({
  leftColumn,
  rightColumn,
  footer,
}: PaymentContentProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Main container with responsive two-column layout - flex-1 to push footer down */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left column - Order Summary (sticky on desktop) */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-8">{leftColumn}</div>
          </div>

          {/* Right column - Action Area */}
          <div className="lg:col-span-7">{rightColumn}</div>
        </div>
      </div>

      {/* Footer - stays at bottom */}
      {footer !== null && (
        footer || (
          <footer className="py-6 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center text-sm text-muted-foreground">
                Powered by <span className="font-brand font-medium text-foreground">PayIn</span> · Secure multi-chain payments
              </div>
            </div>
          </footer>
        )
      )}
    </div>
  );
}
