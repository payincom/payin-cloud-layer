import { Hono } from 'hono';
import type { CloudRouteHandlersOptions } from '../routes/factory.js';
import { createCloudRouteHandlers } from '../routes/factory.js';
import { toLegacyCloudRouteResponse, type LegacyCloudResponseEnvelope, type LegacyPagination } from '../routes/legacy-compat.js';
import type { CloudRouteResponse } from '../routes/http.js';
import type { PublicDepositStatusView, PublicOrderStatusView, PublicPaymentLinkCheckoutView, PublicRuntimeDiscoveryView } from '../public-checkout.js';
import { renderPublicDepositStatusHtml, renderPublicOrderStatusHtml, renderPublicPaymentLinkCheckoutHtml, toLegacyPublicOrderStatusResponse } from '../public-checkout.js';

export interface CloudHonoPublicCheckoutAdapter {
  getOrderStatus(input: { orderId: string }): Promise<PublicOrderStatusView | null> | PublicOrderStatusView | null;
  getPaymentLinkCheckout(input: { slug: string; requestOrigin: string }): Promise<PublicPaymentLinkCheckoutView | null> | PublicPaymentLinkCheckoutView | null;
  createPaymentLinkOrder?(input: { slug: string; requestOrigin: string; body: Record<string, unknown> }): Promise<PublicOrderStatusView | null> | PublicOrderStatusView | null;
  getPaymentLinkPreview?(input: { paymentLinkId: string; token?: string; viewport?: string; requestOrigin: string }): Promise<PublicPaymentLinkCheckoutView | null> | PublicPaymentLinkCheckoutView | null;
  getDepositStatus?(input: { address: string; requestOrigin: string }): Promise<PublicDepositStatusView | null> | PublicDepositStatusView | null;
  getRuntimeDiscovery?(): Promise<PublicRuntimeDiscoveryView> | PublicRuntimeDiscoveryView;
}

export interface CloudHonoAdapterOptions extends CloudRouteHandlersOptions {
  legacyEnvelopes?: boolean;
  publicCheckout?: CloudHonoPublicCheckoutAdapter;
}

export type CloudHonoApp = Hono;

export function createCloudHonoApp(options: CloudHonoAdapterOptions): CloudHonoApp {
  const app = new Hono();
  const routes = createCloudRouteHandlers({ services: options.services });
  const legacy = options.legacyEnvelopes ?? false;

  app.post('/api/v1/orders', async (c) => respond(c, await routes.orders.createOrder({ headers: headers(c), body: await jsonBody(c) as never }), legacy, 'data'));
  app.get('/api/v1/orders', async (c) => respond(c, await routes.orders.listOrders({ headers: headers(c), body: undefined, query: query(c) }), legacy, 'data+pagination'));
  app.get('/api/v1/orders/:orderId', async (c) => respond(c, await routes.orders.getOrder({ headers: headers(c), body: undefined, params: { orderId: c.req.param('orderId') } }), legacy, 'data'));

  app.post('/api/v1/payment-links', async (c) => respond(c, await routes.paymentLinks.createPaymentLink({ headers: headers(c), body: await jsonBody(c) as never }), legacy, 'data'));
  app.get('/api/v1/payment-links', async (c) => respond(c, await routes.paymentLinks.listPaymentLinks({ headers: headers(c), body: undefined, query: query(c) }), legacy, 'data+pagination'));
  app.get('/api/v1/payment-links/:paymentLinkId', async (c) => respond(c, await routes.paymentLinks.getPaymentLink({ headers: headers(c), body: undefined, params: { paymentLinkId: c.req.param('paymentLinkId') } }), legacy, 'data'));
  app.post('/api/v1/payment-links/:paymentLinkId/publish', async (c) => respond(c, await routes.paymentLinks.publishPaymentLink({ headers: headers(c), body: await jsonBody(c) as never, params: { paymentLinkId: c.req.param('paymentLinkId') } }), legacy, 'data'));

  if (routes.apiKeys) {
    app.post('/api/v1/organizations/:organizationId/api-keys', async (c) => respond(c, await routes.apiKeys!.createApiKey({ headers: headers(c), body: await jsonBody(c) as never }), legacy, 'apiKey+metadata'));
    app.get('/api/v1/organizations/:organizationId/api-keys', async (c) => respond(c, await routes.apiKeys!.listApiKeys({ headers: headers(c), body: undefined }), legacy, 'apiKeys'));
    app.delete('/api/v1/organizations/:organizationId/api-keys/:apiKeyId', async (c) => respond(c, await routes.apiKeys!.revokeApiKey({ headers: headers(c), body: undefined, params: { apiKeyId: c.req.param('apiKeyId') } }), legacy, 'empty'));
  }

  if (routes.configs) {
    app.get('/api/v1/config', async (c) => respond(c, await routes.configs!.getConfig({ headers: headers(c), body: undefined }), legacy, 'config'));
    app.put('/api/v1/config', async (c) => respond(c, await routes.configs!.updateConfig({ headers: headers(c), body: await jsonBody(c) as never }), legacy, 'config'));
  }

  app.post('/api/v1/address-pool/import', async (c) => respond(c, await routes.addressPool.importAddresses({ headers: headers(c), body: await jsonBody(c) as never }), legacy, 'data'));
  app.get('/api/v1/address-pool/summary', async (c) => respond(c, await routes.addressPool.getSummary({ headers: headers(c), body: undefined }), legacy, 'data'));
  app.get('/api/v1/address-pool/addresses', async (c) => respond(c, await routes.addressPool.listAddresses({ headers: headers(c), body: undefined, query: query(c) }), legacy, 'data'));

  app.post('/api/v1/webhooks/endpoints', async (c) => {
    const body = await jsonBody(c) as Record<string, unknown>;
    const endpointId = typeof body.id === 'string' ? body.id : `wh_${Date.now()}`;
    return respond(c, await routes.webhooks.upsertEndpoint({ headers: headers(c), body: body as never, params: { endpointId } }), legacy, 'webhookEndpoint');
  });
  app.put('/api/v1/webhooks/endpoints/:endpointId', async (c) => respond(c, await routes.webhooks.upsertEndpoint({ headers: headers(c), body: await jsonBody(c) as never, params: { endpointId: c.req.param('endpointId') } }), legacy, 'webhookEndpoint'));
  app.post('/api/v1/webhooks/endpoints/:endpointId/test', async (c) => respond(c, await routes.webhooks.createTestDelivery({ headers: headers(c), body: await jsonBody(c) as never, params: { endpointId: c.req.param('endpointId') } }), legacy, 'data'));

  if (routes.readiness) {
    app.get('/api/v1/readiness', async (c) => respond(c, await routes.readiness!.getReadiness({ headers: headers(c), body: undefined }), legacy, 'data'));
    app.post('/api/v1/smoke', async (c) => respond(c, await routes.readiness!.runSmoke({ headers: headers(c), body: undefined }), legacy, 'data'));
  }

  if (options.publicCheckout) {
    app.get('/api/chains', async (c) => publicDiscoveryResponse(c, options.publicCheckout!.getRuntimeDiscovery, 'chains'));
    app.get('/api/tokens', async (c) => publicDiscoveryResponse(c, options.publicCheckout!.getRuntimeDiscovery, 'tokens'));
    app.get('/api/v1/chains', async (c) => publicDiscoveryResponse(c, options.publicCheckout!.getRuntimeDiscovery, 'chains'));
    app.get('/api/v1/tokens', async (c) => publicDiscoveryResponse(c, options.publicCheckout!.getRuntimeDiscovery, 'tokens'));

    app.get('/api/payment-links/:slug', async (c) => {
      const slug = c.req.param('slug')?.trim();
      if (!slug) return c.json({ success: false, error: 'Invalid payment link', message: 'Provide a valid payment link slug.' }, 400);
      const checkout = await options.publicCheckout!.getPaymentLinkCheckout({ slug, requestOrigin: requestOrigin(c) });
      if (!checkout) return c.json({ success: false, error: 'Payment Link Not Found', message: 'We could not locate this payment link. It may have expired or been removed.' }, 404);
      return c.json({ success: true, data: checkout });
    });

    app.post('/api/payment-links/:slug/orders', async (c) => {
      if (!options.publicCheckout!.createPaymentLinkOrder) return c.json({ success: false, error: 'Checkout order creation is not configured' }, 501);
      const slug = c.req.param('slug')?.trim();
      if (!slug) return c.json({ success: false, error: 'Invalid payment link', message: 'Provide a valid payment link slug.' }, 400);
      try {
        const order = await options.publicCheckout!.createPaymentLinkOrder({ slug, requestOrigin: requestOrigin(c), body: await jsonBody(c) as Record<string, unknown> });
        if (!order) return c.json({ success: false, error: 'Payment Link Not Found', message: 'We could not locate this payment link. It may have expired or been removed.' }, 404);
        return c.json({ success: true, data: order, orderUrl: `${requestOrigin(c)}/pay/order/${encodeURIComponent(order.orderId)}` }, 201);
      } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Unable to create checkout order' }, 400);
      }
    });

    app.get('/checkout/preview/:paymentLinkId', async (c) => {
      if (!options.publicCheckout!.getPaymentLinkPreview) return c.json({ success: false, error: 'Checkout preview is not configured' }, 501);
      const preview = await options.publicCheckout!.getPaymentLinkPreview({ paymentLinkId: c.req.param('paymentLinkId'), token: c.req.query('token'), viewport: c.req.query('viewport'), requestOrigin: requestOrigin(c) });
      if (!preview) return c.json({ success: false, error: 'Payment Link Preview Not Found', message: 'Preview token is invalid or the payment link does not exist.' }, 404);
      if (wantsHtml(c)) return c.html(renderPublicPaymentLinkCheckoutHtml(preview));
      return c.json({ success: true, data: preview });
    });

    app.get('/api/order-status/:orderId', async (c) => {
      const status = await options.publicCheckout!.getOrderStatus({ orderId: c.req.param('orderId') });
      if (!status) return c.json({ success: false, error: 'Order not found', message: `Order with ID "${c.req.param('orderId')}" does not exist` }, 404);
      if (wantsHtml(c)) return c.html(renderPublicOrderStatusHtml(status));
      return c.json(toLegacyPublicOrderStatusResponse(status));
    });

    app.get('/pay/order/:orderId', async (c) => {
      const status = await options.publicCheckout!.getOrderStatus({ orderId: c.req.param('orderId') });
      if (!status) return c.html('<!doctype html><title>Order not found</title><h1>Order not found</h1>', 404);
      return c.html(renderPublicOrderStatusHtml(status));
    });

    app.get('/pay/deposit/:address', async (c) => {
      if (!options.publicCheckout!.getDepositStatus) return c.html('<!doctype html><title>Deposit not configured</title><h1>Deposit page is not configured</h1>', 501);
      const deposit = await options.publicCheckout!.getDepositStatus({ address: c.req.param('address'), requestOrigin: requestOrigin(c) });
      if (!deposit) return c.html('<!doctype html><title>Deposit not found</title><h1>Deposit not found</h1>', 404);
      return c.html(renderPublicDepositStatusHtml(deposit));
    });

    app.get('/api/deposits/:address/status', async (c) => {
      if (!options.publicCheckout!.getDepositStatus) return c.json({ success: false, error: 'Deposit status is not configured' }, 501);
      const deposit = await options.publicCheckout!.getDepositStatus({ address: c.req.param('address'), requestOrigin: requestOrigin(c) });
      if (!deposit) return c.json({ success: false, error: 'Deposit Not Found', message: 'We could not locate this deposit address.' }, 404);
      return c.json({ success: true, data: deposit });
    });

    app.get('/checkout/:slug', async (c) => {
      const slug = c.req.param('slug')?.trim();
      if (!slug) return c.json({ success: false, error: 'Invalid payment link', message: 'Provide a valid payment link slug to open checkout.' }, 400);
      const checkout = await options.publicCheckout!.getPaymentLinkCheckout({ slug, requestOrigin: requestOrigin(c) });
      if (!checkout) return c.json({ success: false, error: 'Payment Link Not Found', message: 'We could not locate this payment link. It may have expired or been removed.' }, 404);
      if (wantsHtml(c)) return c.html(renderPublicPaymentLinkCheckoutHtml(checkout));
      return c.json({ success: true, data: checkout });
    });
  }

  return app;
}

async function respond(c: { json: (body: unknown, status?: never) => Response }, response: CloudRouteResponse, legacy: boolean, envelope: LegacyCloudResponseEnvelope): Promise<Response> {
  const adapted = legacy ? toLegacyCloudRouteResponse(response, envelope, { pagination: paginationFromBody(response.body) }) : response;
  return c.json(adapted.body, adapted.status as never);
}

function headers(c: { req: { raw: Request } }): Record<string, string | undefined> {
  return Object.fromEntries(c.req.raw.headers.entries());
}

function query(c: { req: { query: () => Record<string, string> } }): Record<string, string | undefined> {
  return c.req.query();
}

async function jsonBody(c: { req: { raw: Request } }): Promise<unknown> {
  if (!hasJsonBody(c.req.raw)) return {};
  return c.req.raw.json();
}

function hasJsonBody(request: Request): boolean {
  if (request.method === 'GET' || request.method === 'HEAD') return false;
  const contentLength = request.headers.get('content-length');
  if (contentLength === '0') return false;
  const contentType = request.headers.get('content-type') ?? '';
  return contentType.includes('application/json');
}

function paginationFromBody(body: unknown): LegacyPagination | undefined {
  if (body && typeof body === 'object' && 'pagination' in body) return (body as { pagination?: LegacyPagination }).pagination;
  return undefined;
}

function requestOrigin(c: { req: { raw: Request; header: (name: string) => string | undefined } }): string {
  const url = new URL(c.req.raw.url);
  const protocol = c.req.header('x-forwarded-proto') ?? url.protocol.replace(/:$/, '');
  const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? url.host;
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

function wantsHtml(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const accept = c.req.header('accept') ?? '';
  return accept.includes('text/html') && !accept.includes('application/json');
}

async function publicDiscoveryResponse(
  c: { json: (body: unknown, status?: never) => Response },
  discovery: (() => Promise<PublicRuntimeDiscoveryView> | PublicRuntimeDiscoveryView) | undefined,
  key: 'chains' | 'tokens'
): Promise<Response> {
  if (!discovery) return c.json({ success: false, error: 'Runtime discovery is not configured' }, 501 as never);
  const data = await discovery();
  return c.json({ success: true, data: data[key] });
}
