import type { CloudCapability } from '../entitlements.js';
import type { CloudAuditService } from '../services/audit-service.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteResponse } from './http.js';

export interface CloudAuditRouteHandlersOptions {
  audit: Pick<CloudAuditService, 'listEvents'>;
}

export interface CloudAuditEventListRouteQuery {
  action?: string;
  actorId?: string;
}

export function createCloudAuditRouteHandlers(options: CloudAuditRouteHandlersOptions) {
  return {
    async listEvents(request: { headers: Record<string, string | undefined>; query?: CloudAuditEventListRouteQuery; body?: void }): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const events = await options.audit.listEvents({
          apiKey,
          action: request.query?.action as CloudCapability | undefined,
          actorId: request.query?.actorId,
        });
        return { status: 200, body: { data: events } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },
  };
}
