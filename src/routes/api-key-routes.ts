import type { CloudApiKeyService } from '../services/api-key-service.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteRequest, type CloudRouteResponse } from './http.js';
import type { CloudRouteWithParams } from './payment-link-routes.js';
import type { CloudCapability } from '../entitlements.js';
import type { CloudOrganizationRole } from '../organization.js';

export interface CloudApiKeyRouteHandlersOptions {
  apiKeys: Pick<CloudApiKeyService, 'createApiKey' | 'listApiKeys' | 'revokeApiKey'>;
}

export interface CloudApiKeyCreateRouteBody {
  name: string;
  role?: CloudOrganizationRole;
  capabilities?: CloudCapability[];
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export function createCloudApiKeyRouteHandlers(options: CloudApiKeyRouteHandlersOptions) {
  return {
    async createApiKey(request: CloudRouteRequest<CloudApiKeyCreateRouteBody>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const created = await options.apiKeys.createApiKey({
          apiKey,
          name: request.body.name,
          role: request.body.role,
          capabilities: request.body.capabilities,
          expiresAt: request.body.expiresAt,
          metadata: request.body.metadata,
        });
        return { status: 201, body: { data: created } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async listApiKeys(request: CloudRouteRequest<void>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const keys = await options.apiKeys.listApiKeys({ apiKey });
        return { status: 200, body: { data: keys } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async revokeApiKey(request: CloudRouteWithParams<void, { apiKeyId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const revoked = await options.apiKeys.revokeApiKey({ apiKey, apiKeyId: request.params.apiKeyId });
        return { status: 200, body: { data: revoked } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },
  };
}
