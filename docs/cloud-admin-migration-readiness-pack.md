# Cloud admin migration readiness pack

Goal: prepare a safe migration of hosted admin assets from `payin-cloud` into `payin-cloud-layer` without copying payment core or secrets.

## Readiness checklist

### 1. Source inventory

- Admin frontend source identified: `apps/admin/`.
- Admin deployment assets identified: `Dockerfile.admin`, `railway.production.admin.toml`, `railway.test.admin.toml`.
- Deployment helper identified: `scripts/deployment/deploy-admin-to-railway.sh`.
- Existing Cloud-layer docs: `docs/cloud-assets-inventory.md`, `docs/cloud-deployment-assets-inventory.md`, `docs/deployment.md`.

### 2. Open export seam

- `payin-cloud-layer` depends on `@payin/app` via `file:../payin-open/apps/api`.
- `npm run validate` builds Open API first, then type-checks/builds the layer.
- Required Open API artifact: `../payin-open/apps/api/dist/server.js` and declaration files.

### 3. Safety constraints

- Keep payment core in `payin-open`.
- Do not copy processor, manager, auth, monitor, shared, notification packages.
- Do not commit environment files or real provider credentials.
- Use placeholders only in examples.
- Run `npm run safety:scan` after every migration slice.

### 4. Proposed migration slices

1. Copy admin app skeleton and install only frontend dependencies needed for a build.
2. Replace direct hosted assumptions with environment-driven API base URLs.
3. Adapt Railway admin templates into sanitized templates.
4. Add Cloud-layer admin build script.
5. Run `npm run validate` plus an admin-focused build check.
6. Review generated diff for forbidden core copies and secret markers.

## Current recovery note

This file was previously a zero-byte placeholder. It has been reconstructed as a readiness pack for review. It is not proof that the admin app migration is complete; it is a safe checklist for the next bounded implementation slice.
