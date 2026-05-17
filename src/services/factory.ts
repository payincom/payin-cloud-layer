import { CloudApiKeyAuthenticator } from '../api-key.js';
import type { EntitlementProvider } from '../entitlements.js';
import type { CloudLayerPorts } from '../ports.js';
import { StaticCloudWebhookSigner, type CloudWebhookSigner } from '../webhooks.js';
import type { MutableCloudWebhookEndpointRepository } from '../adapters/repositories/webhook-adapter.js';
import type { SubscriptionBillingLimitEnforcer } from '../subscription.js';
import { CloudAddressPoolService } from './address-pool-service.js';
import { CloudOrderService } from './order-service.js';
import { CloudPaymentLinkService } from './payment-link-service.js';
import { CloudWebhookService } from './webhook-service.js';

export interface CloudServiceLayerOptions {
  ports: CloudLayerPorts;
  entitlementProvider: EntitlementProvider;
  authenticator?: CloudApiKeyAuthenticator;
  webhookSigner?: CloudWebhookSigner;
  billingLimitEnforcer?: SubscriptionBillingLimitEnforcer;
}

export interface CloudServiceLayer {
  authenticator: CloudApiKeyAuthenticator;
  addressPool: CloudAddressPoolService;
  orders: CloudOrderService;
  paymentLinks: CloudPaymentLinkService;
  webhooks: CloudWebhookService;
}

export function createCloudServiceLayer(options: CloudServiceLayerOptions): CloudServiceLayer {
  const authenticator = options.authenticator ?? new CloudApiKeyAuthenticator(options.ports.apiKeys);
  const webhookSigner = options.webhookSigner ?? new StaticCloudWebhookSigner('dev-signature');

  return {
    authenticator,
    addressPool: new CloudAddressPoolService({
      authenticator,
      entitlementProvider: options.entitlementProvider,
      addressPool: options.ports.addressPool,
      usageMeter: options.ports.usageMeter,
      auditTrail: options.ports.auditTrail,
      billingLimitEnforcer: options.billingLimitEnforcer,
    }),
    orders: new CloudOrderService({
      authenticator,
      entitlementProvider: options.entitlementProvider,
      hostedConfig: options.ports.hostedConfig,
      orders: options.ports.orders,
      usageMeter: options.ports.usageMeter,
      auditTrail: options.ports.auditTrail,
      billingLimitEnforcer: options.billingLimitEnforcer,
    }),
    paymentLinks: new CloudPaymentLinkService({
      authenticator,
      entitlementProvider: options.entitlementProvider,
      hostedConfig: options.ports.hostedConfig,
      paymentLinks: options.ports.paymentLinks,
      usageMeter: options.ports.usageMeter,
      auditTrail: options.ports.auditTrail,
      billingLimitEnforcer: options.billingLimitEnforcer,
    }),
    webhooks: new CloudWebhookService({
      authenticator,
      entitlementProvider: options.entitlementProvider,
      webhooks: options.ports.webhooks as MutableCloudWebhookEndpointRepository,
      signer: webhookSigner,
      usageMeter: options.ports.usageMeter,
      auditTrail: options.ports.auditTrail,
      billingLimitEnforcer: options.billingLimitEnforcer,
    }),
  };
}
