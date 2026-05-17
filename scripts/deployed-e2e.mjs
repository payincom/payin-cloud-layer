const baseUrl = process.env.PAYIN_E2E_BASE_URL;
const apiKey = process.env.PAYIN_E2E_API_KEY ?? process.env.PAYIN_ADMIN_API_KEY ?? 'pk_live_cloud_layer_sandbox_admin';
if (!baseUrl) {
  console.error('PAYIN_E2E_BASE_URL is required');
  process.exit(2);
}
const cleanBase = baseUrl.replace(/\/$/, '');
const authHeaders = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
async function request(path, init = {}) {
  const response = await fetch(`${cleanBase}${path}`, init);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed ${response.status}: ${text}`);
  }
  return body;
}
function expect(condition, message, detail) {
  if (!condition) throw new Error(`${message}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
}
const suffix = Date.now().toString(36);
const readiness = await request('/api/v1/readiness', { headers: authHeaders });
expect(readiness?.data?.checks?.some((check) => check.name === 'hosted-config'), 'readiness includes hosted-config', readiness);
const config = await request('/api/v1/config', { headers: authHeaders });
expect(config?.config?.enabledTokens?.includes('USDC'), 'config includes USDC', config);
const chains = await request('/api/chains');
expect(chains?.data?.some((chain) => chain.id === 'ethereum-sepolia'), 'public chains include ethereum-sepolia', chains);
const tokens = await request('/api/v1/tokens');
expect(tokens?.data?.some((token) => token.symbol === 'USDC'), 'public tokens include USDC', tokens);
const order = await request('/api/v1/orders', { method: 'POST', headers: authHeaders, body: JSON.stringify({ orderReference: `deployed-e2e-${suffix}`, amount: '12.34', currency: 'USDC', chainId: 'ethereum-sepolia', metadata: { source: 'deployed-e2e' } }) });
expect(order?.data?.id, 'order created', order);
const status = await request(`/api/order-status/${order.data.id}`);
expect(status?.data?.orderReference === `deployed-e2e-${suffix}`, 'public order status matches', status);
const statusHtml = await fetch(`${cleanBase}/pay/order/${order.data.id}`, { headers: { accept: 'text/html' } });
const statusHtmlText = await statusHtml.text();
expect(statusHtml.ok, 'public order status HTML returns success', { status: statusHtml.status, body: statusHtmlText });
expect(statusHtmlText.includes('id="payin-order-status-data"'), 'public order status HTML embeds JSON data');
const orderTransfers = await request(`/api/orders/${order.data.id}/transfers`);
expect(orderTransfers?.data?.[0]?.transactionHash === `pending-${order.data.id}`, 'order transfers include pending transfer placeholder', orderTransfers);
const transferStatus = await request(`/api/transfers/${orderTransfers.data[0].transactionHash}/status`);
expect(transferStatus?.data?.orderId === order.data.id, 'transfer status links back to order', transferStatus);
const link = await request('/api/v1/payment-links', { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: `Deployed E2E ${suffix}`, amount: '25.50', currency: 'USDC', chainOptions: ['ethereum-sepolia'], inventoryTotal: 5 }) });
expect(link?.data?.id, 'payment link created', link);
const slug = `deployed-e2e-${suffix}`;
const published = await request(`/api/v1/payment-links/${link.data.id}/publish`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ slug }) });
expect(published?.data?.slug === slug, 'payment link published with slug', published);
const checkout = await request(`/checkout/${slug}`);
expect(checkout?.data?.slug === slug, 'public checkout matches slug', checkout);
const publicPaymentLink = await request(`/api/payment-links/${slug}`);
expect(publicPaymentLink?.data?.slug === slug, 'public payment link API matches slug', publicPaymentLink);
const checkoutOrder = await request(`/api/payment-links/${slug}/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ buyerEmail: `buyer+${suffix}@example.com`, chainId: 'ethereum-sepolia', orderReference: `checkout-order-${suffix}` }) });
expect(checkoutOrder?.data?.orderReference === `checkout-order-${suffix}`, 'public payment link order created', checkoutOrder);
expect(checkoutOrder?.orderUrl?.endsWith(`/pay/order/${checkoutOrder.data.orderId}`), 'public payment link order URL returned', checkoutOrder);
const checkoutHtml = await fetch(`${cleanBase}/checkout/${slug}`, { headers: { accept: 'text/html' } });
const checkoutHtmlText = await checkoutHtml.text();
expect(checkoutHtml.ok, 'public checkout HTML returns success', { status: checkoutHtml.status, body: checkoutHtmlText });
expect(checkoutHtmlText.includes('id="payin-checkout-data"'), 'public checkout HTML embeds JSON data');
const previewHtml = await fetch(`${cleanBase}/checkout/preview/${link.data.id}`, { headers: { accept: 'text/html' } });
const previewHtmlText = await previewHtml.text();
expect(previewHtml.ok, 'checkout preview HTML returns success', { status: previewHtml.status, body: previewHtmlText });
expect(previewHtmlText.includes('id="payin-checkout-data"'), 'checkout preview HTML embeds JSON data');
const address = `0x${suffix.padStart(40, '1').slice(0, 40)}`;
const imported = await request('/api/v1/address-pool/import', { method: 'POST', headers: authHeaders, body: JSON.stringify({ protocol: 'evm', addresses: [{ address }] }) });
expect(imported?.data?.[0]?.address === address, 'address imported', imported);
const depositHtml = await fetch(`${cleanBase}/pay/deposit/${address}`, { headers: { accept: 'text/html' } });
const depositHtmlText = await depositHtml.text();
expect(depositHtml.ok, 'deposit HTML returns success', { status: depositHtml.status, body: depositHtmlText });
expect(depositHtmlText.includes('id="payin-deposit-status-data"'), 'deposit HTML embeds JSON data');
const depositStatus = await request(`/api/deposits/${address}/status`);
expect(depositStatus?.data?.address === address, 'deposit status API returns imported address', depositStatus);
const summary = await request('/api/v1/address-pool/summary', { headers: authHeaders });
expect(summary?.data?.hasAddresses === true, 'address summary has addresses', summary);
const endpointId = `wh-${suffix}`;
const endpoint = await request('/api/v1/webhooks/endpoints', { method: 'POST', headers: authHeaders, body: JSON.stringify({ id: endpointId, url: 'https://merchant.example/webhooks/payin', eventTypes: ['webhook.tested'], signingSecretRef: 'secret://deployed-e2e/webhook', enabled: true }) });
expect(endpoint?.endpoint?.id === endpointId, 'webhook endpoint upserted', endpoint);
const webhookEndpoints = await request('/api/v1/webhooks/endpoints', { headers: authHeaders });
expect(webhookEndpoints?.endpoints?.some((candidate) => candidate.id === endpointId), 'webhook endpoint listed', webhookEndpoints);
const webhookTest = await request(`/api/v1/webhooks/endpoints/${endpointId}/test`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ eventId: `evt-${suffix}` }) });
expect(webhookTest?.data?.endpointId === endpointId, 'webhook tested', webhookTest);
const deleteWebhookResponse = await fetch(`${cleanBase}/api/v1/webhooks/endpoints/${endpointId}`, { method: 'DELETE', headers: authHeaders });
expect(deleteWebhookResponse.status === 204, 'webhook endpoint deleted', { status: deleteWebhookResponse.status, body: await deleteWebhookResponse.text() });
const childApiKey = await request('/api/v1/organizations/org-cloud-layer-sandbox/api-keys', { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: `Deployed E2E ${suffix}`, role: 'member', capabilities: ['orders:create'] }) });
expect(/^pk_live_/.test(childApiKey?.apiKey ?? ''), 'child api key returned', childApiKey);
const auditEvents = await request('/api/v1/audit-events?action=api-keys:create', { headers: authHeaders });
expect(auditEvents?.data?.some((event) => event.subjectId === childApiKey?.metadata?.id || event.subjectId === childApiKey?.apiKey?.id), 'audit events include child api key creation', auditEvents);
const smoke = await request('/api/v1/smoke', { method: 'POST', headers: authHeaders });
expect(smoke?.data?.checks?.some((check) => check.name === 'runtime-smoke'), 'smoke contains runtime-smoke', smoke);
const unauth = await fetch(`${cleanBase}/api/v1/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
expect(unauth.status === 401, 'unauthorized request returns 401', { status: unauth.status, body: await unauth.text() });
console.log(JSON.stringify({ ok: true, baseUrl: cleanBase, orderId: order.data.id, paymentLinkId: link.data.id, slug, endpointId }, null, 2));
