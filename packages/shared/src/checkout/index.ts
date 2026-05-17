/**
 * Checkout page renderers for different environments.
 *
 * For API server (Node.js): use renderPaymentLinkCheckoutPage (default export)
 * For Admin preview (Browser): use renderPaymentLinkCheckoutPageBrowser
 *
 * Note: Due to bundler optimizations, the default export auto-selects
 * the correct renderer based on the environment.
 */

// Export Node.js renderer as default (used by API)
export { renderPaymentLinkCheckoutPage } from './renderCheckout.js';

// Export browser renderer with explicit name (for Admin if needed)
export { renderPaymentLinkCheckoutPage as renderPaymentLinkCheckoutPageBrowser } from './renderCheckoutBrowser.js';

// Export types
export type {
  PaymentLinkCheckoutData,
  PaymentLinkCheckoutRenderOptions,
  PaymentLinkCheckoutCurrency,
} from './CheckoutPage.js';

// Export component for direct use
export { CheckoutPage } from './CheckoutPage.js';
export type { CheckoutPageProps } from './CheckoutPage.js';

// Export OrderPage component and types
export { OrderPage } from './OrderPage.js';
export type { OrderPageProps, OrderPageData, OrderPageRenderOptions } from './OrderPage.js';

// Export Order page renderer (Node.js SSR)
export { renderOrderPage } from './renderOrder.js';

// Export shared components
export { PaymentLayout } from './components/PaymentLayout.js';
export { PaymentContent } from './components/PaymentContent.js';
export { OrderSummary } from './components/OrderSummary.js';
export type { PaymentLayoutProps } from './components/PaymentLayout.js';
export type { PaymentContentProps } from './components/PaymentContent.js';
export type { OrderSummaryData } from './components/OrderSummary.js';
