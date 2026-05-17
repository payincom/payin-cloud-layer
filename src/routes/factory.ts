import type { CloudApiKeyService } from '../services/api-key-service.js';
import type { CloudAddressPoolService } from '../services/address-pool-service.js';
import type { CloudHostedConfigService } from '../services/hosted-config-service.js';
import type { CloudOrganizationService } from '../services/organization-service.js';
import type { CloudOrderService } from '../services/order-service.js';
import type { CloudPaymentLinkService } from '../services/payment-link-service.js';
import type { CloudWebhookService } from '../services/webhook-service.js';
import { createCloudApiKeyRouteHandlers } from './api-key-routes.js';
import { createCloudAddressPoolRouteHandlers } from './address-pool-routes.js';
import { createCloudHostedConfigRouteHandlers } from './hosted-config-routes.js';
import { createCloudOrderRouteHandlers } from './order-routes.js';
import { createCloudOrganizationRouteHandlers } from './organization-routes.js';
import { createCloudPaymentLinkRouteHandlers } from './payment-link-routes.js';
import { createCloudWebhookRouteHandlers } from './webhook-routes.js';

export interface CloudRouteHandlersOptions {
  services: {
    apiKeys?: Pick<CloudApiKeyService, 'createApiKey' | 'listApiKeys' | 'revokeApiKey'>;
    addressPool: Pick<CloudAddressPoolService, 'importAddresses' | 'getSummary'>;
    configs?: Pick<CloudHostedConfigService, 'getConfig' | 'updateConfig'>;
    organizations?: Pick<CloudOrganizationService, 'getCurrentOrganization' | 'updateOrganization' | 'listMembers' | 'addMember' | 'updateMember'>;
    orders: Pick<CloudOrderService, 'createOrder'>;
    paymentLinks: Pick<CloudPaymentLinkService, 'createPaymentLink' | 'publishPaymentLink'>;
    webhooks: Pick<CloudWebhookService, 'upsertEndpoint' | 'createTestDelivery'>;
  };
}

export function createCloudRouteHandlers(options: CloudRouteHandlersOptions) {
  return {
    ...(options.services.apiKeys ? { apiKeys: createCloudApiKeyRouteHandlers({ apiKeys: options.services.apiKeys }) } : {}),
    ...(options.services.configs ? { configs: createCloudHostedConfigRouteHandlers({ configs: options.services.configs }) } : {}),
    ...(options.services.organizations ? { organizations: createCloudOrganizationRouteHandlers({ organizations: options.services.organizations }) } : {}),
    addressPool: createCloudAddressPoolRouteHandlers({ addressPool: options.services.addressPool }),
    orders: createCloudOrderRouteHandlers({ orders: options.services.orders }),
    paymentLinks: createCloudPaymentLinkRouteHandlers({ paymentLinks: options.services.paymentLinks }),
    webhooks: createCloudWebhookRouteHandlers({ webhooks: options.services.webhooks }),
  };
}
