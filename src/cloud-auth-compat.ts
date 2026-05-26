import type { Hono } from 'hono';

type MagicLinkDelivery = 'disabled';
type MagicLinkMode = 'compatibility-stub' | 'local-dev';

interface MagicLinkRequest {
  email?: unknown;
  redirectTo?: unknown;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mountCloudAuthCompatibilityRoutes(api: Hono, env: NodeJS.ProcessEnv = process.env) {
  api.post('/auth/magic-link', async c => {
    const body = await parseJsonBody(c.req.raw);
    if (!body.ok) {
      return c.json(
        {
          success: false,
          authenticated: false,
          code: 'INVALID_JSON',
          error: 'Request body must be valid JSON.',
        },
        400
      );
    }

    const request = body.value as MagicLinkRequest;
    const email = normalizeEmail(request.email);
    if (!email) {
      return c.json(
        {
          success: false,
          authenticated: false,
          code: 'INVALID_EMAIL',
          error: 'A valid email field is required.',
        },
        400
      );
    }

    const redirectTo = normalizeRedirectTo(request.redirectTo);
    if (request.redirectTo !== undefined && !redirectTo) {
      return c.json(
        {
          success: false,
          authenticated: false,
          code: 'INVALID_REDIRECT_TO',
          error: 'redirectTo must be an absolute http(s) URL or root-relative path.',
        },
        400
      );
    }

    const mode = magicLinkMode(env);
    return c.json(
      {
        success: true,
        authenticated: false,
        delivery: 'disabled' satisfies MagicLinkDelivery,
        mode,
        email,
        redirectTo,
        message: 'Magic-link email delivery is disabled in the Cloud Layer compatibility stub.',
        nextAction: {
          type: 'local-dev-login',
          label: 'Use OAuth or a future hosted auth provider to complete sign-in.',
          public: true,
        },
      },
      202
    );
  });
}

async function parseJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return emailPattern.test(email) ? email : null;
}

function normalizeRedirectTo(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const redirectTo = value.trim();
  if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) return redirectTo;
  try {
    const url = new URL(redirectTo);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function magicLinkMode(env: NodeJS.ProcessEnv): MagicLinkMode {
  return env.PAYIN_CLOUD_AUTH_COMPAT_MODE === 'local-dev' ? 'local-dev' : 'compatibility-stub';
}
