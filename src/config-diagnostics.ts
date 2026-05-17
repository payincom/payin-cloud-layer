export interface CloudMonitorDiagnosticsInput {
  requestedChains?: string[];
  skippedProviders?: string[];
  unresolvedApiKeys?: Array<{ key: string; value: string }>;
  validation?: Record<string, unknown>;
  buildError?: string | null;
  error?: string;
}

export interface CloudConfigDiagnosticsInput {
  timestamp?: Date;
  nodeEnv?: string;
  managerConfigFile?: string | null;
  runtimeConfig?: unknown;
  managerMonitorConfig?: CloudManagerMonitorConfig | null;
  monitorDiagnostics?: CloudMonitorDiagnosticsInput | null;
}

export interface CloudManagerMonitorConfig {
  chains?: string[];
  rpcKeys?: Record<string, unknown>;
  customProviders?: Record<string, unknown>;
  rpc?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CloudConfigDiagnostics {
  timestamp: string;
  nodeEnv: string;
  managerConfigFile: string | null;
  runtimeConfig?: unknown;
  managerMonitorConfig: CloudManagerMonitorConfig | null;
  monitorDiagnostics: CloudMonitorDiagnosticsInput | null;
}

export function createCloudConfigDiagnostics(input: CloudConfigDiagnosticsInput = {}): CloudConfigDiagnostics {
  return {
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    nodeEnv: input.nodeEnv ?? 'development',
    managerConfigFile: input.managerConfigFile ?? null,
    ...(input.runtimeConfig !== undefined ? { runtimeConfig: input.runtimeConfig } : {}),
    managerMonitorConfig: input.managerMonitorConfig ? sanitizeCloudMonitorConfig(input.managerMonitorConfig) : null,
    monitorDiagnostics: input.monitorDiagnostics ?? null,
  };
}

export function sanitizeCloudMonitorConfig(config: CloudManagerMonitorConfig): CloudManagerMonitorConfig {
  const rpcKeys = Object.fromEntries(
    Object.entries(config.rpcKeys ?? {}).map(([key, value]) => [key, sanitizeCloudSecretLikeValue(value)])
  );

  return {
    ...config,
    ...(Object.keys(rpcKeys).length ? { rpcKeys } : {}),
  };
}

export function sanitizeCloudSecretLikeValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (/\$\{[^}]+\}/.test(value)) return value;
  if (value.length === 0) return value;
  return '[configured]';
}

export function toLegacyConfigDiagnosticsResponse(diagnostics: CloudConfigDiagnostics): { success: true; data: CloudConfigDiagnostics } {
  return { success: true, data: diagnostics };
}
