export interface CloudRouteRequest<TBody = unknown> {
  headers: Record<string, string | undefined>;
  body: TBody;
}

export interface CloudRouteResponse<TBody = unknown> {
  status: number;
  body: TBody;
}

export interface CloudRouteErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export function extractBearerApiKey(headers: Record<string, string | undefined>): string {
  const authorization = headers.authorization ?? headers.Authorization;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) {
    throw new CloudRouteInputError('CLOUD_ROUTE_UNAUTHORIZED', 'Bearer API key is required', 401);
  }
  return match[1].trim();
}

export class CloudRouteInputError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message);
    this.name = 'CloudRouteInputError';
  }
}

export function toCloudRouteErrorResponse(error: unknown): CloudRouteResponse<CloudRouteErrorBody> {
  if (error instanceof CloudRouteInputError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  }

  const message = error instanceof Error ? error.message : 'Cloud route failed';
  if (message.includes('not entitled') || message.includes('not authorized')) {
    return { status: 403, body: { error: { code: 'CLOUD_ROUTE_FORBIDDEN', message } } };
  }
  if (message.includes('not found')) {
    return { status: 404, body: { error: { code: 'CLOUD_ROUTE_NOT_FOUND', message } } };
  }
  return { status: 400, body: { error: { code: 'CLOUD_ROUTE_BAD_REQUEST', message } } };
}
