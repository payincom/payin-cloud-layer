# Cloud Admin M1 implementation report

Date: 2026-05-25

## Scope

Implemented Cloud Layer milestone M1 plus the safe M4 packaging slice: `payin-cloud-layer` now owns an npm workspace admin UI app under `apps/admin`, adapted from `../payin-cloud/apps/admin` as frontend-only source/config/public assets.

## What changed

- Added root npm workspaces for `apps/*`.
- Added root `type-check:admin` and `build:admin` scripts.
- Extended `validate` to preserve the existing Open API build, Cloud layer type-check/build, and safety scan while adding the admin build before safety scan.
- Migrated admin UI `src/`, `public/`, Vite/TypeScript/PostCSS/ESLint config, `components.json`, `index.html`, package metadata, and README into `apps/admin`.
- Removed deprecated `@supabase/supabase-js` dependency; the existing Supabase module remains a no-op stub with no external package dependency.
- Set all admin fallback API URLs to `http://localhost:3000/api/v1`.
- Documented `VITE_API_URL` and `VITE_PAYMENT_LINK_PUBLIC_URL` as public browser configuration only.
- Extended safety scanning to cover `apps/admin/src` and to forbid copied backend/core directories such as `apps/api`, `packages/processor`, `packages/manager`, and `packages/auth`.

## Safety boundaries

- No `.env*` files were copied.
- No `apps/api` backend routes were copied.
- No Open/backend core packages were copied.
- No edits were made to `../payin-open` or `../payin-cloud`.
- Admin app source may contain frontend API client methods and UI labels, but backend route/core implementation imports and forbidden directories are blocked by `npm run safety:scan`.

## Public env contract

- `VITE_API_URL` defaults to `http://localhost:3000/api/v1`.
- `VITE_PAYMENT_LINK_PUBLIC_URL` is optional and public; if omitted, the UI derives payment-link URLs from the configured API origin.
- Because Vite embeds `VITE_*` values into browser assets, these variables must never contain secrets or credentials.

## Known blocker

- `POST /auth/magic-link` is still a backend/API capability blocker for live magic-link login. This M1 slice does not implement auth route parity; it only preserves the UI call path and documents the dependency.

## Validation evidence

- `npm install`: passed; lockfile/workspace dependencies updated; 0 vulnerabilities. Evidence: `.apcp/logs/cloud-admin-m1-npm-install-20260525.log`.
- `npm run build:admin`: passed; Vite emitted a chunk-size warning only. Evidence: `.apcp/logs/cloud-admin-m1-build-admin-20260525.log`.
- `npm run validate`: passed; preserved Open API build, Cloud layer type-check/build, admin build, and safety scan. Evidence: `.apcp/logs/cloud-admin-m1-validate-20260525.log`.
- `npm run smoke:policy`: passed; runtime smoke policy checks succeeded. Evidence: `.apcp/logs/cloud-admin-m1-smoke-policy-20260525.log`.
- APCP checker: passed with 0 errors for M1 state and `state-cloud-complete`; warnings are pre-existing/active-state hygiene items. Evidence: `.apcp/logs/cloud-admin-m1-apcp-check-20260525.log`.
