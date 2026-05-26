type RuntimeHealthMode = 'layer' | 'open';

export interface CloudRuntimeConfig {
  healthMode: RuntimeHealthMode;
  runtimeName: string;
}

export interface CloudRuntimeState {
  config: CloudRuntimeConfig;
  startedAt: string;
}

export function loadCloudRuntimeConfig(env: NodeJS.ProcessEnv = process.env): CloudRuntimeConfig {
  const requestedMode = env.PAYIN_CLOUD_HEALTH_MODE;
  const healthMode: RuntimeHealthMode = requestedMode === 'open' ? 'open' : 'layer';

  return {
    healthMode,
    runtimeName: env.PAYIN_CLOUD_RUNTIME_NAME ?? 'local-mvp',
  };
}

export function createCloudRuntimeState(
  config: CloudRuntimeConfig = loadCloudRuntimeConfig()
): CloudRuntimeState {
  return {
    config,
    startedAt: new Date().toISOString(),
  };
}

export function createLayerHealthManagerProvider<Manager>(runtime: CloudRuntimeState) {
  return () => {
    if (runtime.config.healthMode === 'open') {
      throw new Error('Open manager health mode requires an initialized PayIn Open manager');
    }

    return {
      cloudLayerHealthProbe: true,
      runtimeName: runtime.config.runtimeName,
      startedAt: runtime.startedAt,
    } as Manager;
  };
}

export function cloudRuntimeStatus(runtime: CloudRuntimeState) {
  return {
    ok: true,
    layer: 'payin-cloud-layer',
    base: 'payin-open',
    coreForked: false,
    runtime: {
      name: runtime.config.runtimeName,
      healthMode: runtime.config.healthMode,
      startedAt: runtime.startedAt,
      managerBoundary:
        runtime.config.healthMode === 'layer'
          ? 'layer-owned health probe; Open manager is not initialized by Cloud Layer boot'
          : 'Open manager health is required and may return 503 until initialized by Open runtime',
    },
  };
}
