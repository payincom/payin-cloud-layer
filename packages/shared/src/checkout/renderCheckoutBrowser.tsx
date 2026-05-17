/**
 * Browser-side rendering for Admin preview.
 * Uses react-dom/server.browser for SSR in browser environment.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { CheckoutPage, type CheckoutPageProps} from './CheckoutPage.js';

/**
 * Render payment link checkout page to HTML string (Browser).
 * This function is used by the Admin preview for client-side SSR.
 */
export function renderPaymentLinkCheckoutPage(
  data: CheckoutPageProps['data'],
  options: CheckoutPageProps['options'],
): string {
  return '<!DOCTYPE html>' + renderToStaticMarkup(<CheckoutPage data={data} options={options} />);
}

// Re-export types for convenience
export type {
  PaymentLinkCheckoutData,
  PaymentLinkCheckoutRenderOptions,
  PaymentLinkCheckoutCurrency,
} from './CheckoutPage.js';
