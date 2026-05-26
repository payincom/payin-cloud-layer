# Cloud admin inventory

Source inspected: `/data/openclaw/workspace/payincom/payin-cloud`.

Purpose: identify hosted-admin assets that belong in `payin-cloud-layer` while keeping payment core in `payin-open`.

## Admin application

- `apps/admin/` is the hosted PayIn Cloud admin frontend.
- Keep it in the Cloud layer as a separate app that calls the composed Open API plus hosted-only Cloud endpoints.
- Do not move it into `payin-open` payment core.

## Deployment assets

- `Dockerfile.admin`: admin frontend build/runtime image.
- `railway.production.admin.toml`: production admin Railway service template.
- `railway.test.admin.toml`: sandbox admin Railway service template.
- `scripts/deployment/deploy-admin-to-railway.sh`: hosted deployment helper.

Migration rule: copy only templates/scripts after redacting or parameterizing environment-specific IDs, domains, and credentials. Runtime values stay in provider configuration, not repository files.

## Hosted-only capabilities

- Cloud login / social auth UX.
- Organization switching and organization-scoped admin UX.
- Global/admin configuration screens.
- Hosted deployment and operator documentation.

These capabilities should remain Cloud-layer concerns and use `createApp(options)` / `@payin/app/server` instead of forking Open payment routes.

## Exclusions

- No payment processor package copy.
- No manager/auth package fork.
- No route business-logic copy.
- No secrets, private keys, DB URLs, API keys, or production tokens.

## Current recovery note

This file was previously a zero-byte placeholder. It has been reconstructed as a bounded inventory so `docs/cloud-admin-inventory.md` is no longer empty and can be reviewed before any actual migration work.
