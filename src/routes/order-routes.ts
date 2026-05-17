import type { CloudOrderService } from '../services/order-service.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteRequest, type CloudRouteResponse } from './http.js';

export interface CloudOrderRouteHandlersOptions {
  orders: Pick<CloudOrderService, 'createOrder' | 'getOrder' | 'listOrders'>;
}

export interface CloudOrderCreateRouteBody {
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  metadata?: Record<string, unknown>;
}

export interface CloudOrderListRouteQuery {
  status?: string;
  page?: number;
  limit?: number;
}

export interface CloudOrderRouteWithParams<TBody = unknown, TParams extends Record<string, string> = Record<string, string>> extends CloudRouteRequest<TBody> {
  params: TParams;
  query?: Record<string, string | number | undefined>;
}

export function createCloudOrderRouteHandlers(options: CloudOrderRouteHandlersOptions) {
  return {
    async createOrder(request: CloudRouteRequest<CloudOrderCreateRouteBody>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const order = await options.orders.createOrder({
          apiKey,
          orderReference: request.body.orderReference,
          amount: request.body.amount,
          currency: request.body.currency,
          chainId: request.body.chainId,
          metadata: request.body.metadata,
        });
        return { status: 201, body: { data: order } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async getOrder(request: CloudOrderRouteWithParams<void, { orderId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const order = await options.orders.getOrder({ apiKey, orderId: request.params.orderId });
        return { status: 200, body: { data: order } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async listOrders(request: CloudRouteRequest<void> & { query?: CloudOrderListRouteQuery }): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const orders = await options.orders.listOrders({ apiKey, status: request.query?.status });
        const page = Number(request.query?.page ?? 1);
        const limit = Number(request.query?.limit ?? (orders.length || 20));
        return { status: 200, body: { data: orders, pagination: createRoutePagination(orders.length, page, limit) } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },
  };
}

function createRoutePagination(total: number, page: number, limit: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : Math.max(total, 1);
  return { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) };
}
