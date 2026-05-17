import { serve } from '@hono/node-server';
import { createPayInCloudRuntime } from './standalone-runtime.js';

const port = Number(process.env.PORT ?? 3000);
const runtime = createPayInCloudRuntime({
  tenant: {
    organizationId: process.env.PAYIN_ORGANIZATION_ID ?? 'org-cloud-layer-sandbox',
    tenantId: process.env.PAYIN_TENANT_ID ?? process.env.PAYIN_ORGANIZATION_ID ?? 'org-cloud-layer-sandbox',
    plan: (process.env.PAYIN_PLAN as 'free' | 'pro' | 'enterprise' | undefined) ?? 'pro',
  },
  adminApiKey: process.env.PAYIN_ADMIN_API_KEY ?? 'pk_live_cloud_layer_sandbox_admin',
  webhookSignature: process.env.PAYIN_WEBHOOK_TEST_SIGNATURE,
});

serve({ fetch: runtime.app.fetch, port }, (info) => {
  console.log(JSON.stringify({ event: 'payin-cloud-runtime.started', port: info.port, tenant: runtime.tenant.tenantId }));
});
