import type { CloudOrganizationService } from '../services/organization-service.js';
import { extractBearerApiKey, toCloudRouteErrorResponse, type CloudRouteRequest, type CloudRouteResponse } from './http.js';
import type { CloudRouteWithParams } from './payment-link-routes.js';
import type { CloudMembershipStatus, CloudOrganizationRole, UpdateCloudOrganizationInput } from '../organization.js';

export interface CloudOrganizationRouteHandlersOptions {
  organizations: Pick<CloudOrganizationService, 'getCurrentOrganization' | 'updateOrganization' | 'listMembers' | 'addMember' | 'updateMember'>;
}

export type CloudOrganizationUpdateRouteBody = UpdateCloudOrganizationInput;
export interface CloudOrganizationAddMemberRouteBody { userId: string; role: Exclude<CloudOrganizationRole, 'owner'> }
export interface CloudOrganizationUpdateMemberRouteBody { role?: CloudOrganizationRole; status?: CloudMembershipStatus }

export function createCloudOrganizationRouteHandlers(options: CloudOrganizationRouteHandlersOptions) {
  return {
    async getCurrentOrganization(request: CloudRouteRequest<void>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const organization = await options.organizations.getCurrentOrganization({ apiKey });
        return { status: 200, body: { data: organization } };
      } catch (error) { return toCloudRouteErrorResponse(error); }
    },

    async updateOrganization(request: CloudRouteRequest<CloudOrganizationUpdateRouteBody>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const organization = await options.organizations.updateOrganization({ apiKey, ...request.body });
        return { status: 200, body: { data: organization } };
      } catch (error) { return toCloudRouteErrorResponse(error); }
    },

    async listMembers(request: CloudRouteRequest<void>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const members = await options.organizations.listMembers({ apiKey });
        return { status: 200, body: { data: members } };
      } catch (error) { return toCloudRouteErrorResponse(error); }
    },

    async addMember(request: CloudRouteRequest<CloudOrganizationAddMemberRouteBody>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const member = await options.organizations.addMember({ apiKey, userId: request.body.userId, role: request.body.role });
        return { status: 201, body: { data: member } };
      } catch (error) { return toCloudRouteErrorResponse(error); }
    },

    async updateMember(request: CloudRouteWithParams<CloudOrganizationUpdateMemberRouteBody, { userId: string }>): Promise<CloudRouteResponse> {
      try {
        const apiKey = extractBearerApiKey(request.headers);
        const member = await options.organizations.updateMember({ apiKey, userId: request.params.userId, role: request.body.role, status: request.body.status });
        return { status: 200, body: { data: member } };
      } catch (error) { return toCloudRouteErrorResponse(error); }
    },
  };
}
