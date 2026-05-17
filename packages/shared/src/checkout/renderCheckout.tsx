/**
 * Server-side rendering for Node.js (API server).
 * Uses react-dom/server for SSR in Node.js environment.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CheckoutPage, type CheckoutPageProps } from './CheckoutPage.js';

/**
 * Render payment link checkout page to HTML string (Node.js).
 * This function is used by the API server for server-side rendering.
 */
export function renderPaymentLinkCheckoutPage(
  data: CheckoutPageProps['data'],
  options: CheckoutPageProps['options'],
): string {
  return '<!DOCTYPE html>' + renderToString(<CheckoutPage data={data} options={options} />);
}

// Re-export types for convenience
export type {
  PaymentLinkCheckoutData,
  PaymentLinkCheckoutRenderOptions,
  PaymentLinkCheckoutCurrency,
} from './CheckoutPage.js';
