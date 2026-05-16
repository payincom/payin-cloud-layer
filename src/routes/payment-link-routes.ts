import type { CloudPaymentLinkService } from '../services/payment-link-service.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteRequest, type CloudRouteResponse } from './http.js';

export interface CloudPaymentLinkRouteHandlersOptions {
  paymentLinks: Pick<CloudPaymentLinkService, 'createPaymentLink' | 'publishPaymentLink'>;
}

export interface CloudPaymentLinkCreateRouteBody {
  title: string;
  description?: string;
  amount: string;
  currency: string;
  chainOptions: string[];
  inventoryTotal?: number | null;
  metadata?: Record<string, unknown>;
}

export interface CloudPaymentLinkPublishRouteBody {
  slug?: string;
}

export interface CloudRouteWithParams<TBody = unknown, TParams extends Record<string, string> = Record<string, string>> extends CloudRouteRequest<TBody> {
  params: TParams;
}

export function createCloudPaymentLinkRouteHandlers(options: CloudPaymentLinkRouteHandlersOptions) {
  return {
    async createPaymentLink(request: CloudRouteRequest<CloudPaymentLinkCreateRouteBody>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const link = await options.paymentLinks.createPaymentLink({
          apiKey,
          title: request.body.title,
          description: request.body.description,
          amount: request.body.amount,
          currency: request.body.currency,
          chainOptions: request.body.chainOptions,
          inventoryTotal: request.body.inventoryTotal,
          metadata: request.body.metadata,
        });
        return { status: 201, body: { data: link } };
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
  };
}
