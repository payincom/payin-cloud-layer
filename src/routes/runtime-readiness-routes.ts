import type { RuntimeReadinessReport } from '../runtime-readiness.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteRequest, type CloudRouteResponse } from './http.js';

export interface CloudRuntimeReadinessService {
  getReadiness(input: { apiKey: string }): Promise<RuntimeReadinessReport> | RuntimeReadinessReport;
  runSmoke(input: { apiKey: string }): Promise<RuntimeReadinessReport> | RuntimeReadinessReport;
}

export interface CloudRuntimeReadinessRouteHandlersOptions {
  readiness: CloudRuntimeReadinessService;
}

export function createCloudRuntimeReadinessRouteHandlers(options: CloudRuntimeReadinessRouteHandlersOptions) {
  return {
    async getReadiness(request: CloudRouteRequest<void>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const report = await options.readiness.getReadiness({ apiKey });
        return { status: report.status === 'fail' ? 503 : 200, body: { data: report } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async runSmoke(request: CloudRouteRequest<void>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const report = await options.readiness.runSmoke({ apiKey });
        return { status: report.status === 'fail' ? 503 : 200, body: { data: report } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },
  };
}
