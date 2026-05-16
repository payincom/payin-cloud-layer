import type { CloudAddressPoolService } from '../services/address-pool-service.js';
import type { CloudOrderService } from '../services/order-service.js';
import type { CloudPaymentLinkService } from '../services/payment-link-service.js';
import type { CloudWebhookService } from '../services/webhook-service.js';
import { createCloudAddressPoolRouteHandlers } from './address-pool-routes.js';
import { createCloudOrderRouteHandlers } from './order-routes.js';
import { createCloudPaymentLinkRouteHandlers } from './payment-link-routes.js';
import { createCloudWebhookRouteHandlers } from './webhook-routes.js';

export interface CloudRouteHandlersOptions {
  services: {
    addressPool: Pick<CloudAddressPoolService, 'importAddresses' | 'getSummary'>;
    orders: Pick<CloudOrderService, 'createOrder'>;
    paymentLinks: Pick<CloudPaymentLinkService, 'createPaymentLink' | 'publishPaymentLink'>;
    webhooks: Pick<CloudWebhookService, 'upsertEndpoint' | 'createTestDelivery'>;
  };
}

export function createCloudRouteHandlers(options: CloudRouteHandlersOptions) {
  return {
    addressPool: createCloudAddressPoolRouteHandlers({ addressPool: options.services.addressPool }),
    orders: createCloudOrderRouteHandlers({ orders: options.services.orders }),
    paymentLinks: createCloudPaymentLinkRouteHandlers({ paymentLinks: options.services.paymentLinks }),
    webhooks: createCloudWebhookRouteHandlers({ webhooks: options.services.webhooks }),
  };
}
