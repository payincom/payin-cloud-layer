# PayIn Cloud Layer Admin

Cloud-owned admin UI workspace adapted from `../payin-cloud/apps/admin` as frontend-only source. This app is intentionally packaged inside `payin-cloud-layer` without copied Open/backend core packages, API route implementations, or `.env*` files.

## Runtime serving

The Cloud API serves the built admin bundle from `apps/admin/dist` at `/admin`. Vite is configured with `base: '/admin/'` so built assets resolve under `/admin/assets/*`; nested browser routes such as `/admin/cloud-layer/control-plane` rely on the API SPA fallback to `index.html`.

## Public configuration

- `VITE_API_URL`: public API base URL. Defaults in source to `http://localhost:3000/api/v1`.
- `VITE_PAYMENT_LINK_PUBLIC_URL`: optional public base URL for payment-link previews.

Vite exposes `VITE_*` values to browser JavaScript at build time. Use these variables only for public routing/config values. Do not store secrets, private tokens, provider credentials, or keys in `VITE_*` variables.

## Local Cloud Layer shell

The Cloud-owned route `/admin/cloud-layer/control-plane` demonstrates the M6/M7 local SaaS control plane from the migrated Admin UI. It calls only `/api/v1/cloud-layer/control-plane/*`, labels the behavior as local-dev-only, shows current org and entitlement status, and displays API key preview/checksum metadata without secrets.

M7 keeps the panel behind the `CloudControlPlaneProvider` API contract. The UI depends on stable route shapes for status, dev login, current org, API-key metadata, and entitlements; switching from the local provider to a future hosted DB provider should not require UI route changes. The current provider descriptor is visible in the status response and remains `productionReady: false`.

The control plane defaults to in-memory storage. For development-only durability, run the API with `PAYIN_CLOUD_LOCAL_CONTROL_PLANE_DURABLE=true` and `PAYIN_CLOUD_LOCAL_CONTROL_PLANE_FILE=/path/to/local-control-plane.json`. This JSON file is not production-grade security storage; it exists only to exercise the storage seam before a hosted DB-backed provider replaces it.

For a local loop:

1. From the repo root, run `npm run build:admin && npm run build && npm start`.
2. Open `http://localhost:3000/admin`.
3. On `/admin/login`, click `Enter Local Cloud Layer Shell`; this calls the dev-only Cloud Layer control-plane login and stores a `local-dev-control-plane:*` token in the existing API client/localStorage path.
4. Open `http://localhost:3000/admin/cloud-layer/control-plane` and use `Create Local Preview` to create non-secret API key preview metadata and watch entitlement quota usage refresh.

## Local commands

```sh
npm run type-check -w apps/admin
npm run build -w apps/admin
```

Auth compatibility for local smoke coverage is exposed by the Cloud API at `POST /api/v1/auth/magic-link`; real hosted magic-link delivery remains future work for a Cloud auth provider.
