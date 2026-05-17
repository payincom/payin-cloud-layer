import type { CloudHostedConfigService } from '../services/hosted-config-service.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteRequest, type CloudRouteResponse } from './http.js';
import type { HostedRuntimeConfigInput } from '../hosted-config.js';

export interface CloudHostedConfigRouteHandlersOptions {
  configs: Pick<CloudHostedConfigService, 'getConfig' | 'updateConfig'>;
}

export type CloudHostedConfigUpdateRouteBody = Partial<Omit<HostedRuntimeConfigInput, 'tenant'>>;

export function createCloudHostedConfigRouteHandlers(options: CloudHostedConfigRouteHandlersOptions) {
  return {
    async getConfig(request: CloudRouteRequest<void>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const config = await options.configs.getConfig({ apiKey });
        return { status: 200, body: { data: config } };
      } catch (error) { return toCloudRouteErrorResponse(error); }
    },

    async updateConfig(request: CloudRouteRequest<CloudHostedConfigUpdateRouteBody>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const config = await options.configs.updateConfig({ apiKey, ...request.body });
        return { status: 200, body: { data: config } };
      } catch (error) { return toCloudRouteErrorResponse(error); }
    },
  };
}
