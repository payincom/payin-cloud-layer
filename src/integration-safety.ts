export class IntegrationSafetyError extends Error {
  readonly code = 'INTEGRATION_SAFETY_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'IntegrationSafetyError';
  }
}

export function shouldRunDisposableIntegration(env: Record<string, string | undefined> = process.env): boolean {
  return env.PAYIN_CLOUD_LAYER_INTEGRATION === '1';
}

export function assertDisposableIntegrationDatabaseUrl(databaseUrl: string): void {
  if (!databaseUrl.trim()) {
    throw new IntegrationSafetyError('Integration database URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new IntegrationSafetyError('Integration database URL must be a valid URL');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new IntegrationSafetyError('Integration database URL must be PostgreSQL');
  }

  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
  const host = parsed.hostname.toLowerCase();
  const safe = dbName.includes('test') || dbName.includes('disposable') || host === 'localhost' || host === '127.0.0.1';
  if (!safe) {
    throw new IntegrationSafetyError('Integration database must be disposable/test/localhost');
  }
}
