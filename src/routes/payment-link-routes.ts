import type { CloudPaymentLinkService } from '../services/payment-link-service.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteRequest, type CloudRouteResponse } from './http.js';

export interface CloudPaymentLinkRouteHandlersOptions {
  paymentLinks: Pick<CloudPaymentLinkService, 'createPaymentLink' | 'publishPaymentLink' | 'getPaymentLink' | 'listPaymentLinks'>
    & Partial<Pick<CloudPaymentLinkService, 'updatePaymentLink' | 'updatePaymentLinkCurrencies' | 'unpublishPaymentLink' | 'archivePaymentLink' | 'restorePaymentLink' | 'createPaymentLinkPreviewUrl' | 'listPaymentLinkOrders'>>;
}

export interface CloudPaymentLinkCurrencyRouteBody {
  currency: string;
  chainOptions?: string[];
  chain_options?: string[];
  amount?: string | null;
  isPrimary?: boolean;
  is_primary?: boolean;
}

export interface CloudPaymentLinkCreateRouteBody {
  title: string;
  description?: string;
  amount: string;
  currency?: string;
  currencies?: CloudPaymentLinkCurrencyRouteBody[];
  chainOptions?: string[];
  chain_options?: string[];
  inventoryTotal?: number | null;
  inventory_total?: number | null;
  metadata?: Record<string, unknown>;
  amountType?: 'fixed' | 'user_input';
  amount_type?: 'fixed' | 'user_input';
  ctaText?: string | null;
  cta_text?: string | null;
  theme?: 'dark' | 'light';
}

export interface CloudPaymentLinkPublishRouteBody {
  slug?: string;
}

export type CloudPaymentLinkUpdateRouteBody = Partial<Omit<CloudPaymentLinkCreateRouteBody, 'currency' | 'chainOptions' | 'chain_options' | 'currencies'>>;

export interface CloudPaymentLinkListRouteQuery {
  status?: string;
  page?: number;
  limit?: number;
}

export interface CloudRouteWithParams<TBody = unknown, TParams extends Record<string, string> = Record<string, string>> extends CloudRouteRequest<TBody> {
  params: TParams;
}

export function createCloudPaymentLinkRouteHandlers(options: CloudPaymentLinkRouteHandlersOptions) {
  return {
    async createPaymentLink(request: CloudRouteRequest<CloudPaymentLinkCreateRouteBody>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const normalizedBody = normalizePaymentLinkCreateBody(request.body);
        const link = await options.paymentLinks.createPaymentLink({
          apiKey,
          ...normalizedBody,
        });
        return { status: 201, body: { data: link } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async getPaymentLink(request: CloudRouteWithParams<void, { paymentLinkId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const link = await options.paymentLinks.getPaymentLink({ apiKey, paymentLinkId: request.params.paymentLinkId });
        return { status: 200, body: { data: link } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async listPaymentLinks(request: CloudRouteRequest<void> & { query?: CloudPaymentLinkListRouteQuery }): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const links = await options.paymentLinks.listPaymentLinks({ apiKey, status: request.query?.status });
        const page = Number(request.query?.page ?? 1);
        const limit = Number(request.query?.limit ?? (links.length || 20));
        return { status: 200, body: { data: links, pagination: createRoutePagination(links.length, page, limit) } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async publishPaymentLink(request: CloudRouteWithParams<CloudPaymentLinkPublishRouteBody, { paymentLinkId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const link = await options.paymentLinks.publishPaymentLink({
          apiKey,
          paymentLinkId: request.params.paymentLinkId,
          slug: request.body.slug,
        });
        return { status: 200, body: { data: link } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async updatePaymentLink(request: CloudRouteWithParams<CloudPaymentLinkUpdateRouteBody, { paymentLinkId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const link = await requirePaymentLinkMethod(options.paymentLinks.updatePaymentLink, 'updatePaymentLink')({ apiKey, paymentLinkId: request.params.paymentLinkId, updates: normalizePaymentLinkUpdateBody(request.body) });
        return { status: 200, body: { data: link } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async updatePaymentLinkCurrencies(request: CloudRouteWithParams<{ currencies: CloudPaymentLinkCurrencyRouteBody[] }, { paymentLinkId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const link = await requirePaymentLinkMethod(options.paymentLinks.updatePaymentLinkCurrencies, 'updatePaymentLinkCurrencies')({ apiKey, paymentLinkId: request.params.paymentLinkId, currencies: request.body.currencies ?? [] });
        return { status: 200, body: { data: link } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async unpublishPaymentLink(request: CloudRouteWithParams<void, { paymentLinkId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const link = await requirePaymentLinkMethod(options.paymentLinks.unpublishPaymentLink, 'unpublishPaymentLink')({ apiKey, paymentLinkId: request.params.paymentLinkId });
        return { status: 200, body: { data: link } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async archivePaymentLink(request: CloudRouteWithParams<void, { paymentLinkId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const link = await requirePaymentLinkMethod(options.paymentLinks.archivePaymentLink, 'archivePaymentLink')({ apiKey, paymentLinkId: request.params.paymentLinkId });
        return { status: 200, body: { data: link } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async restorePaymentLink(request: CloudRouteWithParams<void, { paymentLinkId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const link = await requirePaymentLinkMethod(options.paymentLinks.restorePaymentLink, 'restorePaymentLink')({ apiKey, paymentLinkId: request.params.paymentLinkId });
        return { status: 200, body: { data: link } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async createPaymentLinkPreviewUrl(request: CloudRouteWithParams<void, { paymentLinkId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const preview = await requirePaymentLinkMethod(options.paymentLinks.createPaymentLinkPreviewUrl, 'createPaymentLinkPreviewUrl')({ apiKey, paymentLinkId: request.params.paymentLinkId });
        return { status: 200, body: { data: preview } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async listPaymentLinkOrders(request: CloudRouteWithParams<void, { paymentLinkId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const orders = await requirePaymentLinkMethod(options.paymentLinks.listPaymentLinkOrders, 'listPaymentLinkOrders')({ apiKey, paymentLinkId: request.params.paymentLinkId });
        return { status: 200, body: { data: orders } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },
  };
}

function normalizePaymentLinkCreateBody(body: CloudPaymentLinkCreateRouteBody) {
  const primary = getPrimaryCurrency(body.currencies);
  const chainOptions = primary ? (primary.chainOptions ?? primary.chain_options ?? []) : (body.chainOptions ?? body.chain_options ?? []);
  const metadata = removeUndefined({ ...(body.metadata ?? {}), ...(body.currencies ? { currencies: normalizeCurrenciesMetadata(body.currencies) } : {}), amountType: body.amountType ?? body.amount_type, ctaText: body.ctaText ?? body.cta_text, theme: body.theme });
  return removeUndefined({
    title: body.title,
    description: body.description,
    amount: body.amountType === 'user_input' || body.amount_type === 'user_input' ? (primary?.amount ?? body.amount ?? '0') : (primary?.amount ?? body.amount),
    currency: body.currency ?? primary?.currency ?? '',
    chainOptions,
    inventoryTotal: body.inventoryTotal ?? body.inventory_total,
    ...(Object.keys(metadata).length ? { metadata } : {}),
  });
}

function requirePaymentLinkMethod<T extends (...args: never[]) => unknown>(method: T | undefined, name: string): T {
  if (!method) throw new Error(`Payment link method is not configured: ${name}`);
  return method;
}

function normalizePaymentLinkUpdateBody(body: CloudPaymentLinkUpdateRouteBody): Record<string, unknown> {
  return {
    title: body.title,
    description: body.description,
    amount: body.amount,
    inventoryTotal: body.inventoryTotal ?? body.inventory_total,
    metadata: { ...(body.metadata ?? {}), amountType: body.amountType ?? body.amount_type, ctaText: body.ctaText ?? body.cta_text, theme: body.theme },
  };
}

function getPrimaryCurrency(currencies: CloudPaymentLinkCurrencyRouteBody[] | undefined): CloudPaymentLinkCurrencyRouteBody | undefined {
  if (!currencies?.length) return undefined;
  return currencies.find((currency) => currency.isPrimary ?? currency.is_primary) ?? currencies[0];
}

function normalizeCurrenciesMetadata(currencies: CloudPaymentLinkCurrencyRouteBody[]) {
  return currencies.map((currency) => ({
    currency: currency.currency,
    chain_options: currency.chainOptions ?? currency.chain_options ?? [],
    chainOptions: currency.chainOptions ?? currency.chain_options ?? [],
    amount: currency.amount ?? null,
    is_primary: Boolean(currency.isPrimary ?? currency.is_primary),
    isPrimary: Boolean(currency.isPrimary ?? currency.is_primary),
  }));
}

function removeUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

function createRoutePagination(total: number, page: number, limit: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : Math.max(total, 1);
  return { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) };
}
