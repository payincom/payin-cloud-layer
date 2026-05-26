import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Context, Hono } from 'hono';

const adminDistUrl = new URL('../apps/admin/dist/', import.meta.url);
const adminIndexUrl = new URL('index.html', adminDistUrl);
const adminAssetsUrl = new URL('assets/', adminDistUrl);

const adminStaticRoot = './apps/admin/dist';
const publicViteConfigNames = ['VITE_API_URL', 'VITE_PAYMENT_LINK_PUBLIC_URL'] as const;

export function cloudAdminStatus() {
  return {
    ok: true,
    admin: {
      dist: {
        indexHtmlExists: existsSync(adminIndexUrl),
        assetsDirExists: existsSync(adminAssetsUrl),
      },
      publicViteConfig: {
        names: [...publicViteConfigNames],
      },
    },
  };
}

export function mountCloudAdminPublicRoutes(app: Hono) {
  const serveAdminStatic = serveStatic({
    root: adminStaticRoot,
    rewriteRequestPath: path => path.replace(/^\/admin\/?/, '/'),
  });

  app.get('/admin', serveAdminIndex);
  app.use('/admin/*', serveAdminStatic);
  app.get('/admin/*', serveAdminIndex);
}

async function serveAdminIndex(c: Context) {
  if (!existsSync(adminIndexUrl)) {
    return c.json(
      {
        ok: false,
        code: 'ADMIN_DIST_MISSING',
        message: 'Cloud admin dist/index.html was not found. Run npm run build:admin.',
      },
      503
    );
  }

  const indexHtml = await readFile(fileURLToPath(adminIndexUrl), 'utf8');
  return c.html(indexHtml);
}
