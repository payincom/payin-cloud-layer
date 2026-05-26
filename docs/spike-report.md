# payin-cloud-layer spike report

## Feasibility

- Feasible as a local composition spike: `payin-open/apps/api/src/server.ts` exports `createApp(options)` and `CreateAppOptions`.
- `payin-open/apps/api/package.json` now exposes `@payin/app/server`, resolving to `dist/server.js` with `dist/server.d.ts` types.
- The Cloud layer can override `cloudOnlyRouteGuard` to enable hosted routes without copying payment core.
- The Cloud layer can append public/API routes through `extendPublicRoutes` and `extendApiRoutes`.
- Business payment route factories and dependencies remain injectable for selected Open routes, so Cloud policy/event hooks can be layered at route boundaries.

## Prototype

- `src/adapters/open-app.ts` imports `createApp` from `@payin/app/server` and creates a Cloud-composed Hono app.
- The prototype enables hosted guarded routes by replacing the Open guard with a pass-through Cloud guard that adds diagnostic headers.
- The prototype adds `/cloud-layer/status` and `/api/v1/cloud-layer/status` as layer-owned routes.


## M2 auth route parity

- Added a Cloud-owned `POST /api/v1/auth/magic-link` compatibility stub for admin login form parity. It validates JSON input and returns a deterministic non-authenticating response; no email is sent and no token/session is created.
- Kept OAuth config on the existing Open auth route and adjusted Cloud policy to allow `GET /api/v1/auth/oauth/config` through in enforce mode as a public compatibility route.
- Real email delivery and hosted passwordless authentication remain future hosted Cloud auth provider work, not part of this local compatibility shim.
- Safety scanning now covers Cloud source and admin source for direct backend core/package imports as well as forbidden copied backend directories.

## M3 admin runtime integration

- Added Cloud-owned admin runtime serving through `createCloudApiApp()`: `/admin` serves `apps/admin/dist/index.html`, `/admin/assets/*` serves generated admin assets, and nested admin routes fall back to the SPA index.
- Added admin status JSON at `/cloud-layer/admin/status` and `/api/v1/cloud-layer/admin/status` with dist/index existence, asset directory existence, and public Vite config names only.
- Configured the admin Vite build with `base: '/admin/'` so generated browser asset URLs are admin-scoped.
- Documented that `VITE_*` values are public browser config only and must not contain secrets.
- Extended runtime smoke coverage for admin HTML, nested SPA fallback, admin status JSON, and preserved health/status/auth magic-link/OAuth/org policy checks.

## M4 local SaaS control plane

- Added a Cloud-owned in-memory local control-plane provider in `src/local-control-plane.ts` for deterministic organizations, users, session-like dev login, API key metadata, entitlement evaluation, and simple quotas.
- Mounted provider routes under `/api/v1/cloud-layer/control-plane/*` through `createCloudApiApp()` and Open's extension seam, keeping Open payment routes and backend internals untouched.
- API key creation returns only local metadata: id, label, checksum, status, and a non-secret preview ending in `preview_only`; no usable secret material is returned.
- The provider is local-dev-only and not a production security implementation. State is in-memory, timestamps are deterministic for smoke tests, and the hosted DB-backed provider remains the next milestone.
- Extended runtime smoke coverage for control-plane status, bootstrap, dev-login, current org, API key list/create, entitlement quota status, plus prior health/status/admin/auth/OAuth/org policy checks.
- Extended safety scanning to flag direct imports from sibling backend internals such as `../payin-cloud` and `../payin-open/apps/api/src` in implementation files.

## Remaining Blockers

- Build-order boundary remains: `payin-open/apps/api` must be built before the layer can type-check/build/run against `@payin/app/server`.
- Package naming remains a product decision: this local seam uses current `@payin/app`; a future published package may prefer `@payin/open-api`.
- Hosted Cloud routes still live in `payin-open` source and are hidden by guards. This is acceptable for a transition, but longer-term ownership should be clarified.
- The M4 local control-plane provider is in-memory and development-only; the real hosted DB-backed auth/org/API-key/entitlement provider is still required next.

## M6 durable local provider slice

- Added a Cloud control-plane storage abstraction for organizations, users, sessions, API key metadata, and entitlement/quota snapshots.
- Kept in-memory storage as the default local behavior and added an explicit dev-only JSON file storage option gated by `PAYIN_CLOUD_LOCAL_CONTROL_PLANE_DURABLE=true` plus `PAYIN_CLOUD_LOCAL_CONTROL_PLANE_FILE`.
- Preserved the no-secrets boundary: API keys are stored only as preview/checksum metadata, and durable smoke coverage verifies the JSON file does not contain response-only secret-shaped fields.
- Extended runtime smoke coverage for persistence across provider instances using a temp file while retaining prior health/status/admin/auth/OAuth/org policy checks.
- Durable local JSON storage is not production security; it is a local-only seam for the future hosted DB-backed provider.
- Running the full Open runtime still requires normal Open environment/database initialization; this spike validates composition/type boundaries, not end-to-end payments.

## M7 provider boundary hardening and DB seam

- Added an explicit `CloudControlPlaneProvider` contract layer for Cloud auth/session summaries, organizations/tenant lookup, API-key metadata, and entitlement/quota evaluation.
- Kept `LocalControlPlaneProvider` as the active local-development implementation while making routes consume the provider contract instead of a concrete storage implementation.
- Preserved in-memory as the default storage selection and retained gated local JSON storage for deterministic development smokes.
- Added `DisabledPostgresControlPlaneStorage` as a compile-time Postgres/hosted-DB adapter seam. It intentionally creates no external resources, reads no secrets, and fails closed if selected because migrations, connection handling, and secret management are future work.
- Extended runtime smoke coverage so provider selection is explicit: default in-memory, local JSON only with explicit flags, and Postgres placeholder rejected by default.
- The control-plane status endpoint reports `contractVersion: 2026-05-m7`, active storage kind, and `productionReady: false` for this local slice.

## Completed Open Changes

- Added `exports["./server"]` in `payin-open/apps/api/package.json` for `dist/server.js` and `dist/server.d.ts`.
- Kept `CreateAppOptions`, `BuiltInRouteFactories`, and `BuiltInRouteDependencies` exported from `src/server.ts` without changing payment logic.
- Updated `payin-cloud-layer` to depend on `@payin/app` via local file dependency and import `@payin/app/server`.

## Next Steps

- Decide whether the long-term package identity stays `@payin/app` or changes to a dedicated `@payin/open-api` package.
- Add CI/build orchestration so Open API builds before the Cloud layer consumes `@payin/app/server`.
- Add production deployment wiring for the Cloud-served admin runtime and decide whether standalone admin static hosting remains necessary.
- Replace the M7 disabled Postgres placeholder with a real hosted DB-backed provider for production auth/org/API-key/entitlement behavior after migrations, connection handling, and secret management are designed.
- Implement real Cloud guard/auth policy in place of the pass-through spike guard.
- Add Cloud billing/entitlement/audit event sinks through existing route dependency seams.

## Validation Performed

- `npm run build -w apps/api` passed in `payin-open`.
- `npm install` passed in `payin-cloud-layer`, adding a symlinked local `@payin/app` dependency with 0 reported vulnerabilities.
- `npm run type-check` passed in `payin-cloud-layer`.
- `npm run build` passed in `payin-cloud-layer`.
- Runtime smoke through `dist/adapters/open-app.js` passed: `/cloud-layer/status`, `/api/v1/cloud-layer/status`, and `/health` returned 200; `/api/v1/organizations` returned 401 rather than 404, proving the hosted guarded route is mounted.
- Observed non-blocking runtime output from transitive Open dependencies: `bigint` native binding fallback and Node `punycode` deprecation warning.
