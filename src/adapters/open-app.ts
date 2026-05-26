import {
  createApp as createOpenApp,
  type CreateAppOptions,
} from '@payin/app/server';
import { Hono } from 'hono';
import {
  cloudPolicyStatus,
  createCloudPolicyRuntime,
  type CloudPolicyConfig,
  type CloudPolicyDependencies,
} from '../cloud-policy.js';
import { mountCloudAuthCompatibilityRoutes } from '../cloud-auth-compat.js';
import {
  cloudRuntimeStatus,
  createCloudRuntimeState,
  createLayerHealthManagerProvider,
  type CloudRuntimeConfig,
  type CloudRuntimeState,
} from '../cloud-runtime.js';
import { cloudAdminStatus, mountCloudAdminPublicRoutes } from '../cloud-admin.js';
import {
  LocalControlPlaneProvider,
  mountLocalControlPlaneShellRoutes,
  mountLocalControlPlaneRoutes,
} from '../local-control-plane.js';
import {
  createLocalControlPlaneStorageFromEnv,
  type LocalControlPlaneStorage,
} from '../local-control-plane-storage.js';
import { createPostgresControlPlaneStorageFromEnv } from '../postgres-control-plane-storage.js';
import { mountProofModeRoutes } from '../proof-mode.js';
import {
  createLocalOpenSeamPolicies,
  localOpenSeamPolicyStatus,
  mergeLocalOpenSeamPolicies,
} from '../local-open-seam-policies.js';

export interface CloudLayerOptions {
  openApp?: CreateAppOptions;
  policyConfig?: CloudPolicyConfig;
  policyDependencies?: CloudPolicyDependencies;
  runtimeConfig?: CloudRuntimeConfig;
  runtimeState?: CloudRuntimeState;
  localControlPlaneStorage?: LocalControlPlaneStorage;
  localControlPlaneProvider?: LocalControlPlaneProvider;
}

export function createCloudApiApp(options: CloudLayerOptions = {}) {
  const runtime = options.runtimeState ?? createCloudRuntimeState(options.runtimeConfig);
  const policy = createCloudPolicyRuntime(options.policyConfig, options.policyDependencies);
  const controlPlaneStorage =
    options.localControlPlaneStorage ??
    createPostgresControlPlaneStorageFromEnv() ??
    createLocalControlPlaneStorageFromEnv();
  const localControlPlaneProvider =
    options.localControlPlaneProvider ??
    new LocalControlPlaneProvider(controlPlaneStorage);
  const getManager =
    options.openApp?.getManager ??
    createLayerHealthManagerProvider<ReturnType<NonNullable<CreateAppOptions['getManager']>>>(runtime);
  const openSeamPolicies = createLocalOpenSeamPolicies(policy.config);
  const routeDependencies = mergeLocalOpenSeamPolicies(options.openApp?.routeDependencies, openSeamPolicies);

  const openApp = createOpenApp({
    ...options.openApp,
    getManager,
    // Railway sandbox installs payin-open and this overlay as adjacent Node projects,
    // which can materialize two equivalent Hono type identities. Keep the runtime seam
    // explicit and cast only at the adapter boundary; do not copy/fork Open internals.
    routeDependencies: routeDependencies as CreateAppOptions['routeDependencies'],
    cloudOnlyRouteGuard: (options.openApp?.cloudOnlyRouteGuard ?? policy.guard) as CreateAppOptions['cloudOnlyRouteGuard'],
    extendPublicRoutes(app) {
      options.openApp?.extendPublicRoutes?.(app);
      const cloudApp = app as unknown as Hono;

      mountCloudAdminPublicRoutes(cloudApp);

      cloudApp.get('/cloud-layer/status', c =>
        c.json({
          ...cloudRuntimeStatus(runtime),
          policy: cloudPolicyStatus(policy.config),
          openSeams: localOpenSeamPolicyStatus(policy.config),
        })
      );

      cloudApp.get('/cloud-layer/admin/status', c => c.json(cloudAdminStatus()));
    },
    extendApiRoutes(api) {
      options.openApp?.extendApiRoutes?.(api);
      const cloudApi = api as unknown as Hono;

      mountCloudAuthCompatibilityRoutes(cloudApi);
      mountLocalControlPlaneRoutes(cloudApi, localControlPlaneProvider);

      cloudApi.get('/cloud-layer/status', c =>
        c.json({
          ...cloudRuntimeStatus(runtime),
          policy: cloudPolicyStatus(policy.config),
          openSeams: localOpenSeamPolicyStatus(policy.config),
        })
      );

      cloudApi.get('/cloud-layer/admin/status', c => c.json(cloudAdminStatus()));
    },
  });

  const app = new Hono();
  mountProofModeRoutes(app, localControlPlaneProvider);
  mountLocalControlPlaneShellRoutes(
    app,
    localControlPlaneProvider,
    policy.guard as unknown as Parameters<typeof mountLocalControlPlaneShellRoutes>[2],
    runtime,
    policy.config
  );
  app.all('*', c => openApp.fetch(c.req.raw, c.env));
  return app;
}
