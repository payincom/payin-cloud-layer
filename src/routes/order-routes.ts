import type { CloudOrderService } from '../services/order-service.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteRequest, type CloudRouteResponse } from './http.js';

export interface CloudOrderRouteHandlersOptions {
  orders: Pick<CloudOrderService, 'createOrder'>;
}

export interface CloudOrderCreateRouteBody {
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  metadata?: Record<string, unknown>;
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
  };
}
