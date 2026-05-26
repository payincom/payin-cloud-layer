# R11 Railway Admin proof mode

R11 makes the hosted Admin UI operable in the Railway proof environment without initializing PayIn Open auth/payment internals. It remains a deterministic proof mode, not live production auth or payment processing.

## Demo sign-in

- Endpoint: `POST /api/v1/auth/login`
- Default demo email: `admin@example.com`
- Default demo password: `payin-demo-password`
- Optional Railway variable names: `PAYIN_CLOUD_DEMO_EMAIL`, `PAYIN_CLOUD_DEMO_PASSWORD`
- Response: Admin-compatible `success/data.token/data.user` plus an `HttpOnly` `payin_cloud_session` cookie.
- Boundaries: no email is sent, no OAuth provider is called, no mainnet or billing integration is used.

## Proof API coverage

Cloud-layer-owned routes are mounted before the Open app fallback so they do not trip Open's `initializeAuth()` requirement:

- Auth/session: `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/logout`
- Address pool: `/api/v1/address-pool/summary`, `/availability`, `/addresses`, archive/unarchive
- Deposit setup: `/api/v1/deposits/bind`, `/deposits/references`, `/deposits`, `/deposits/stats`, `/transfers`
- Webhook proof: `/api/v1/notifications/endpoints`, endpoint test, logs/statistics/queue, `/api/v1/cloud-layer/proof/external-webhook/order`, `/deposit`

The proof webhook flow records simulated delivery logs only; it does not perform outbound network delivery.

## Smoke

Run locally after build dependencies are installed:

```bash
npm run smoke:r11
```

The smoke covers demo login, address-pool import/summary, deposit reference bind/list/stats, and order/deposit webhook proof triggers. It redacts bearer tokens and cookies in output.

## Validation evidence

R11 evidence is stored under `.apcp/logs/r11-*`, including final type-check, build, admin build, runtime smoke, and R11 proof smoke logs.
