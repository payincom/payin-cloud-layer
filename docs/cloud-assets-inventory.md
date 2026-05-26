# Cloud-only asset inventory

Source inspected: `/data/openclaw/workspace/payincom/payin-cloud`.

## Admin web app

- `apps/admin/`: Cloud-hosted React/Vite admin frontend.
- Key pages: `Dashboard`, `Login`, `AuthCallback`, `Orders`, `Deposits`, `PaymentLinks`, `ApiKeys`, `AddressPool`, `Config`, `GlobalConfig`, and `OrganizationConfig`.
- Key Cloud UX components: `OrganizationSelector`, `OrganizationSwitcher`, `ProtectedRoute`, `SocialLogin`, `AuthContext`, and `src/lib/supabase.ts`.
- Mapping: keep this as a Cloud-layer app. It should call the composed Open API plus Cloud-only hosted endpoints; do not move it into payment core.

## Admin deployment assets

- `Dockerfile.admin`: two-stage admin build and nginx static runtime.
- `railway.production.admin.toml`: production admin service config for `app.payin.com` with `VITE_API_URL` build arg.
- `railway.test.admin.toml`: sandbox admin service config for `sandbox.payin.com` with `VITE_API_URL` build arg.
- Mapping: copy/adapt these into the Cloud overlay repo after redacting environment-specific project IDs/domains or templating them. Runtime secrets should remain Railway/dashboard variables, not repository files.

## Cloud docs and skill

- `docs/cloud-ops/*`: hosted operations docs for chains, config, database initialization, environments, getting started, and troubleshooting.
- `skills/payin-cloud/SKILL.md`: Cloud operator skill/instructions.
- Mapping: Cloud overlay owns hosted ops docs and the Cloud skill; `payin-open` owns self-hosting docs and open runtime docs.

## Hosted API routes currently represented in Open source

- `apps/api/src/routes/organizations.ts`: organization lifecycle/membership/role APIs.
- `apps/api/src/routes/users.ts`: hosted user/admin management APIs.
- `apps/api/src/routes/config-management.ts`: multi-tenant configuration management APIs.
- `apps/api/src/routes/config-diagnostics.ts`: super-admin diagnostics APIs.
- `apps/api/src/routes/auth.ts`: Cloud signup flow creates a personal organization; Open has first-operator registration lock/default organization behavior.
- Mapping: these are still physically present in `payin-open` but guarded by `cloudOnlyRouteGuard` in `apps/api/src/server.ts`. The overlay can enable them via `createApp({ cloudOnlyRouteGuard })` as this spike demonstrates.

## Non-admin Cloud-only top-level files

- `.gemini/`, `.rcloneignore`, `CLAUDE.md`, `sync.sh`, and `test-payment-link-fields.sh` exist only in `payin-cloud`.
- Mapping: review before migration. They are operational/developer assets, not payment core. Avoid copying any credentials or private environment values.

## Core packages not to copy

- Do not copy/fork `packages/processor`, `packages/manager`, `packages/auth`, `packages/monitor`, `packages/shared`, `packages/notification`, or `apps/api/src/routes/*` payment business logic into the Cloud layer.
- Prefer exported Open seams: app composition, route factory dependencies, event/policy seams, and future package exports.
