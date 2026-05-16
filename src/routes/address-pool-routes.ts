import type { CloudAddressPoolService } from '../services/address-pool-service.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteRequest, type CloudRouteResponse } from './http.js';

export interface CloudAddressPoolRouteHandlersOptions {
  addressPool: Pick<CloudAddressPoolService, 'importAddresses' | 'getSummary'>;
}

export interface CloudAddressPoolImportRouteBody {
  protocol: string;
  addresses: Array<{ address: string; derivationIndex?: number | null }>;
  masterPublicKeyRef?: string;
  limit?: number | null;
}

export function createCloudAddressPoolRouteHandlers(options: CloudAddressPoolRouteHandlersOptions) {
  return {
    async importAddresses(request: CloudRouteRequest<CloudAddressPoolImportRouteBody>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const imported = await options.addressPool.importAddresses({
          apiKey,
          protocol: request.body.protocol,
          addresses: request.body.addresses,
          masterPublicKeyRef: request.body.masterPublicKeyRef,
          limit: request.body.limit,
        });
        return { status: 201, body: { data: imported } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },

    async getSummary(request: CloudRouteRequest<void>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const summary = await options.addressPool.getSummary({ apiKey });
        return { status: 200, body: { data: summary } };
      } catch (error) {
        return toCloudRouteErrorResponse(error);
      }
    },
  };
}
