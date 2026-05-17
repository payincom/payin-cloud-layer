import type { CloudWebhookService } from '../services/webhook-service.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteResponse } from './http.js';
import type { CloudRouteWithParams } from './payment-link-routes.js';

export interface CloudWebhookRouteHandlersOptions {
  webhooks: Pick<CloudWebhookService, 'upsertEndpoint' | 'createTestDelivery' | 'listEndpoints' | 'deleteEndpoint' | 'listDeliveries' | 'replayDelivery'>;
}

export interface CloudWebhookEndpointUpsertRouteBody {
  url: string;
  eventTypes: string[];
  signingSecretRef: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

export interface CloudWebhookTestDeliveryRouteBody {
  eventId?: string;
}

export interface CloudWebhookDeliveryListRouteQuery {
  endpointId?: string;
  status?: string;
}

export function createCloudWebhookRouteHandlers(options: CloudWebhookRouteHandlersOptions) {
  return {
    async listEndpoints(request: CloudRouteWithParams<void, Record<string, string>>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const endpoints = await options.webhooks.listEndpoints({ apiKey });
        return { status: 200, body: { data: endpoints } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async upsertEndpoint(request: CloudRouteWithParams<CloudWebhookEndpointUpsertRouteBody, { endpointId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const endpoint = await options.webhooks.upsertEndpoint({
          apiKey,
          id: request.params.endpointId,
          url: request.body.url,
          eventTypes: request.body.eventTypes,
          signingSecretRef: request.body.signingSecretRef,
          enabled: request.body.enabled,
          metadata: request.body.metadata,
        });
        return { status: 200, body: { data: endpoint } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async createTestDelivery(request: CloudRouteWithParams<CloudWebhookTestDeliveryRouteBody, { endpointId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const delivery = await options.webhooks.createTestDelivery({
          apiKey,
          endpointId: request.params.endpointId,
          eventId: request.body.eventId,
        });
        return { status: 200, body: { data: delivery } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async deleteEndpoint(request: CloudRouteWithParams<void, { endpointId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        await options.webhooks.deleteEndpoint({ apiKey, endpointId: request.params.endpointId });
        return { status: 204, body: {} };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async listDeliveries(request: { headers: Record<string, string | undefined>; query?: CloudWebhookDeliveryListRouteQuery; body?: void }): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const deliveries = await options.webhooks.listDeliveries({ apiKey, endpointId: request.query?.endpointId, status: request.query?.status as never });
        return { status: 200, body: { data: deliveries } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async replayDelivery(request: CloudRouteWithParams<void, { deliveryId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const delivery = await options.webhooks.replayDelivery({ apiKey, deliveryId: request.params.deliveryId });
        return { status: 200, body: { data: delivery } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },
  };
}
