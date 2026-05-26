import { serve } from '@hono/node-server';
import { createCloudApiApp } from './adapters/open-app.js';

const port = Number(process.env.PORT ?? 3100);
const hostname = process.env.HOST ?? '127.0.0.1';
const app = createCloudApiApp();

serve({
  fetch: app.fetch,
  port,
  hostname,
});

console.log(`payin-cloud-layer mvp listening on http://${hostname}:${port}`);
