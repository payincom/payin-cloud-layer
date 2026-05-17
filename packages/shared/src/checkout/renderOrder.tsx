/**
 * Order Page SSR renderer for Node.js (API server)
 * Uses react-dom/server for server-side rendering
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderPage, type OrderPageData, type OrderPageRenderOptions } from './OrderPage.js';

/**
 * Render Order Payment Page to HTML string (Node.js environment)
 *
 * @param data - Order data including payment information
 * @param options - Rendering options (API URLs, etc.)
 * @returns HTML string ready to send to browser
 */
export function renderOrderPage(
  data: OrderPageData,
  options: OrderPageRenderOptions
): string {
  return `<!DOCTYPE html>\n${renderToStaticMarkup(
    <OrderPage data={data} options={options} />
  )}`;
}
