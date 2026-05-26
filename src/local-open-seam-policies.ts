import type { CreateAppOptions } from '@payin/app/server';
import type { CloudPolicyConfig, CloudPolicyMode } from './cloud-policy.js';

type RouteDependencies = NonNullable<CreateAppOptions['routeDependencies']>;
type OrdersRouteDependencies = NonNullable<RouteDependencies['orders']>;
type PaymentLinksRouteDependencies = NonNullable<RouteDependencies['paymentLinks']>;
type NotificationsRouteDependencies = NonNullable<RouteDependencies['notifications']>;

type OrderCreatePolicy = NonNullable<OrdersRouteDependencies['orderCreatePolicy']>;
type PaymentLinkPolicy = NonNullable<PaymentLinksRouteDependencies['paymentLinkPolicy']>;
type NotificationPolicy = NonNullable<NotificationsRouteDependencies['notificationPolicy']>;

type OrderCreatePolicyInput = Parameters<OrderCreatePolicy['check']>[0];
type PaymentLinkPolicyInput = Parameters<PaymentLinkPolicy['check']>[0];
type NotificationPolicyInput = Parameters<NotificationPolicy['check']>[0];

type SeamPolicyStatus = 400 | 401 | 403 | 409 | 422 | 429;
type SeamPolicyModeDecision = 'allow' | 'deny';
type SeamPolicyName = 'orderCreatePolicy' | 'paymentLinkPolicy' | 'notificationPolicy';
type SeamPolicyFeature = 'order:create' | 'payment-link:create' | 'payment-link:update' | 'payment-link:publish' | 'notification:create_endpoint' | 'notification:test_endpoint' | 'notification:retry_notification';
type LocalPlanId = 'local-free' | 'local-growth' | 'local-pro' | 'local-enterprise';
type EntitlementSource = 'tenant-map' | 'global' | 'plan-map' | 'policy-off' | 'missing';

export interface LocalOpenSeamPolicyMetadata {
  localDeterministic: true;
  seam: SeamPolicyName;
  mode: CloudPolicyMode;
  tenantId: string | null;
  plan: LocalPlanId | null;
  requiredEntitlement: SeamPolicyFeature;
  source: EntitlementSource;
  enforceDecision: SeamPolicyModeDecision;
}

export interface LocalOpenSeamPolicyDecision {
  allowed: boolean;
  code?: string;
  message?: string;
  status?: SeamPolicyStatus;
  metadata: LocalOpenSeamPolicyMetadata;
}

export interface LocalOpenSeamPolicies {
  orderCreatePolicy: OrderCreatePolicy;
  paymentLinkPolicy: PaymentLinkPolicy;
  notificationPolicy: NotificationPolicy;
}

interface SeamEvaluation {
  allowedByEntitlement: boolean;
  tenantId: string | null;
  plan: LocalPlanId | null;
  source: EntitlementSource;
  enforceDecision: SeamPolicyModeDecision;
  reason: 'allowed' | 'tenant_required' | 'tenant_not_allowed' | 'entitlement_required' | 'policy_off';
}

interface SeamDefinition {
  seam: SeamPolicyName;
  requiredEntitlement: SeamPolicyFeature;
  aliases: readonly string[];
}

const localPlanEntitlements = {
  'local-free': ['order:create'],
  'local-growth': ['order:create', 'payment-link:create', 'payment-link:update', 'payment-link:publish'],
  'local-pro': [
    'order:create',
    'payment-link:create',
    'payment-link:update',
    'payment-link:publish',
    'notification:create_endpoint',
    'notification:test_endpoint',
  ],
  'local-enterprise': [
    'order:create',
    'payment-link:create',
    'payment-link:update',
    'payment-link:publish',
    'notification:create_endpoint',
    'notification:test_endpoint',
    'notification:retry_notification',
  ],
} as const satisfies Record<LocalPlanId, readonly SeamPolicyFeature[]>;

const planAliases: Record<LocalPlanId, readonly string[]> = {
  'local-free': ['local-free', 'free', 'plan:free', 'plan:local-free', 'Local Free Plan'],
  'local-growth': ['local-growth', 'growth', 'starter', 'plan:growth', 'plan:starter', 'plan:local-growth', 'Local Growth Plan'],
  'local-pro': ['local-pro', 'pro', 'professional', 'plan:pro', 'plan:professional', 'plan:local-pro', 'Local Pro Plan'],
  'local-enterprise': ['local-enterprise', 'enterprise', 'plan:enterprise', 'plan:local-enterprise', 'Local Enterprise Plan'],
};

const seamDefinitions = {
  orderCreatePolicy: {
    seam: 'orderCreatePolicy',
    requiredEntitlement: 'order:create',
    aliases: ['order:create', 'orders', 'Orders API', 'Order Creation', 'Order Create'],
  },
  paymentLinkPolicy: {
    seam: 'paymentLinkPolicy',
    requiredEntitlement: 'payment-link:create',
    aliases: ['payment-link:create', 'payment-links', 'Payment Links', 'Payment Links API'],
  },
  notificationPolicy: {
    seam: 'notificationPolicy',
    requiredEntitlement: 'notification:create_endpoint',
    aliases: ['notification:create_endpoint', 'notifications', 'Notifications', 'Notifications API'],
  },
} as const satisfies Record<SeamPolicyName, SeamDefinition>;

export function createLocalOpenSeamPolicies(config: CloudPolicyConfig): LocalOpenSeamPolicies {
  return {
    orderCreatePolicy: {
      check(input: OrderCreatePolicyInput) {
        return toOpenPolicyDecision(evaluateSeamPolicy(config, seamDefinitions.orderCreatePolicy, input.runtimeContext.paymentScope.id));
      },
    },
    paymentLinkPolicy: {
      check(input: PaymentLinkPolicyInput) {
        const definition = paymentLinkDefinition(input.operation);
        return toOpenPolicyDecision(evaluateSeamPolicy(config, definition, input.runtimeContext.paymentScope.id));
      },
    },
    notificationPolicy: {
      check(input: NotificationPolicyInput) {
        const definition = notificationDefinition(input.operation);
        return toOpenPolicyDecision(evaluateSeamPolicy(config, definition, input.runtimeContext.paymentScope.id));
      },
    },
  };
}

export function mergeLocalOpenSeamPolicies(
  routeDependencies: CreateAppOptions['routeDependencies'],
  policies: LocalOpenSeamPolicies
): CreateAppOptions['routeDependencies'] {
  return {
    ...routeDependencies,
    orders: {
      ...routeDependencies?.orders,
      orderCreatePolicy: routeDependencies?.orders?.orderCreatePolicy ?? policies.orderCreatePolicy,
    },
    paymentLinks: {
      ...routeDependencies?.paymentLinks,
      paymentLinkPolicy: routeDependencies?.paymentLinks?.paymentLinkPolicy ?? policies.paymentLinkPolicy,
    },
    notifications: {
      ...routeDependencies?.notifications,
      notificationPolicy: routeDependencies?.notifications?.notificationPolicy ?? policies.notificationPolicy,
    },
  };
}

export function localOpenSeamPolicyStatus(config: CloudPolicyConfig) {
  return {
    provider: 'cloud-layer-local-open-seam-policies',
    deterministic: true,
    localOnly: true,
    mode: config.mode,
    tenantHeader: config.tenantHeader,
    tenantMappings: Object.keys(config.entitlementsByTenant).length,
    globalEntitlements: config.allowedEntitlements.length,
    seams: Object.fromEntries(
      Object.values(seamDefinitions).map(definition => [
        definition.seam,
        {
          requiredEntitlement: definition.requiredEntitlement,
          aliases: definition.aliases,
        },
      ])
    ),
    plans: localPlanEntitlements,
  };
}

function evaluateSeamPolicy(config: CloudPolicyConfig, definition: SeamDefinition, tenantId: string | null): LocalOpenSeamPolicyDecision {
  const evaluation = evaluateEntitlement(config, definition, tenantId);
  const metadata: LocalOpenSeamPolicyMetadata = {
    localDeterministic: true,
    seam: definition.seam,
    mode: config.mode,
    tenantId,
    plan: evaluation.plan,
    requiredEntitlement: definition.requiredEntitlement,
    source: evaluation.source,
    enforceDecision: evaluation.enforceDecision,
  };

  if (config.mode === 'off') {
    return {
      allowed: true,
      message: 'Cloud local Open seam policy is disabled; request allowed by policy mode off.',
      metadata,
    };
  }

  if (config.mode === 'report-only') {
    return {
      allowed: true,
      code: evaluation.enforceDecision === 'deny' ? 'CLOUD_SEAM_POLICY_REPORT_ONLY' : undefined,
      message:
        evaluation.enforceDecision === 'deny'
          ? `Cloud local Open seam policy would deny ${definition.requiredEntitlement}: ${evaluation.reason}.`
          : `Cloud local Open seam policy allowed ${definition.requiredEntitlement}.`,
      metadata,
    };
  }

  if (evaluation.enforceDecision === 'allow') {
    return {
      allowed: true,
      message: `Cloud local Open seam policy allowed ${definition.requiredEntitlement}.`,
      metadata,
    };
  }

  return {
    allowed: false,
    code: 'CLOUD_SEAM_POLICY_DENIED',
    message: `Cloud local Open seam policy denied ${definition.requiredEntitlement}: ${evaluation.reason}.`,
    status: 403,
    metadata,
  };
}

function evaluateEntitlement(config: CloudPolicyConfig, definition: SeamDefinition, tenantId: string | null): SeamEvaluation {
  if (config.mode === 'off') {
    return {
      allowedByEntitlement: true,
      tenantId,
      plan: null,
      source: 'policy-off',
      enforceDecision: 'allow',
      reason: 'policy_off',
    };
  }

  if (!tenantId) {
    return denied(tenantId, null, 'missing', 'tenant_required');
  }

  if (config.allowedTenants.length > 0 && !config.allowedTenants.includes(tenantId)) {
    return denied(tenantId, null, 'missing', 'tenant_not_allowed');
  }

  const tenantEntitlements = config.entitlementsByTenant[tenantId] ?? [];
  if (containsEntitlement(tenantEntitlements, definition)) {
    return allowed(tenantId, resolvePlan(tenantEntitlements), 'tenant-map');
  }

  if (containsEntitlement(config.allowedEntitlements, definition)) {
    return allowed(tenantId, resolvePlan(config.allowedEntitlements), 'global');
  }

  const plan = resolvePlan(tenantEntitlements) ?? resolvePlan(config.allowedEntitlements);
  if (plan && (localPlanEntitlements[plan] as readonly SeamPolicyFeature[]).includes(definition.requiredEntitlement)) {
    return allowed(tenantId, plan, 'plan-map');
  }

  return denied(tenantId, plan, 'missing', 'entitlement_required');
}

function allowed(tenantId: string, plan: LocalPlanId | null, source: EntitlementSource): SeamEvaluation {
  return {
    allowedByEntitlement: true,
    tenantId,
    plan,
    source,
    enforceDecision: 'allow',
    reason: 'allowed',
  };
}

function denied(
  tenantId: string | null,
  plan: LocalPlanId | null,
  source: EntitlementSource,
  reason: SeamEvaluation['reason']
): SeamEvaluation {
  return {
    allowedByEntitlement: false,
    tenantId,
    plan,
    source,
    enforceDecision: 'deny',
    reason,
  };
}

function containsEntitlement(entitlements: readonly string[], definition: SeamDefinition): boolean {
  const normalized = entitlements.map(normalizeEntitlement);
  return [definition.requiredEntitlement, ...definition.aliases].some(alias => normalized.includes(normalizeEntitlement(alias)));
}

function resolvePlan(entitlements: readonly string[]): LocalPlanId | null {
  const normalized = entitlements.map(normalizeEntitlement);
  for (const [plan, aliases] of Object.entries(planAliases) as [LocalPlanId, readonly string[]][]) {
    if (aliases.some(alias => normalized.includes(normalizeEntitlement(alias)))) return plan;
  }
  return null;
}

function normalizeEntitlement(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function paymentLinkDefinition(operation: PaymentLinkPolicyInput['operation']): SeamDefinition {
  if (operation === 'update') {
    return {
      seam: 'paymentLinkPolicy',
      requiredEntitlement: 'payment-link:update',
      aliases: ['payment-link:update', 'payment-links', 'Payment Links', 'Payment Links API'],
    };
  }
  if (operation === 'publish') {
    return {
      seam: 'paymentLinkPolicy',
      requiredEntitlement: 'payment-link:publish',
      aliases: ['payment-link:publish', 'payment-links', 'Payment Links', 'Payment Links API'],
    };
  }
  return seamDefinitions.paymentLinkPolicy;
}

function notificationDefinition(operation: NotificationPolicyInput['operation']): SeamDefinition {
  if (operation === 'test_endpoint') {
    return {
      seam: 'notificationPolicy',
      requiredEntitlement: 'notification:test_endpoint',
      aliases: ['notification:test_endpoint', 'notifications', 'Notifications', 'Notifications API'],
    };
  }
  if (operation === 'retry_notification') {
    return {
      seam: 'notificationPolicy',
      requiredEntitlement: 'notification:retry_notification',
      aliases: ['notification:retry_notification', 'notifications', 'Notifications', 'Notifications API'],
    };
  }
  return seamDefinitions.notificationPolicy;
}

function toOpenPolicyDecision<TDecision extends { allowed: boolean }>(decision: LocalOpenSeamPolicyDecision): TDecision {
  return decision as unknown as TDecision;
}
