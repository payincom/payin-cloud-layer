# Cloud deployment assets inventory

Source inspected locally: `../payin-cloud`. This inventory records deployment/ops structure only. It does not migrate secret values, project identifiers, production domains, or payment-core implementation.

## Classification summary

| Source asset | Classification | Cloud layer action | Notes |
| --- | --- | --- | --- |
| `railway.production.api.toml` | cloud-only | migrate as example template | API deploy shape: hosted builder, build command, watch paths, start command, health check, restart policy. Values are redacted/placeholders. |
| `railway.test.api.toml` | cloud-only | migrate as example template | Same API shape for sandbox/test environment. Collapsed into one environment-parameterized example. |
| `railway.production.admin.toml` | cloud-only | migrate as example template | Admin static frontend deploy shape: Dockerfile builder, Vite build args, health check, restart policy. |
| `railway.test.admin.toml` | cloud-only | migrate as example template | Same admin shape for sandbox/test environment. Collapsed into one example. |
| `railway.test.demo.toml` and `apps/demo/railway.toml` | cloud-only | inventory only for now | Demo/shop deployment is Cloud overlay material, but depends on app ownership decisions outside this template spike. |
| `Dockerfile.admin` | cloud-only | migrate as example template | Static admin build/runtime pattern with placeholder API/public URLs. No admin app source is copied. |
| Root `Dockerfile` | open-seam-needed | do not copy | Builds API by copying Open core packages. Cloud layer should instead consume a stable Open app/package seam. |
| `package.docker.json`, `package-docker-clean.json` | obsolete/do-not-migrate | inventory only | Older reduced Docker package manifests; keep as historical signal, not a target template. |
| `docs/cloud-ops/*` | cloud-only plus open-seam-needed | summarize into deployment docs | Operational concepts are useful, but chain/processor/manager internals require seams instead of copying core implementation. |
| `scripts/deployment/*.sh` | cloud-only with secrets risk | do not copy; document commands | Scripts include project/environment wiring and variable setup patterns. Use documented CLI workflow with placeholders only. |
| `tools/deploy-fast.sh` | obsolete/do-not-migrate | inventory only | Fast local deploy helper is operationally useful but not a clean template for the layer. |
| `tools/import-railway-variables.sh`, setup helpers | cloud-only with secrets risk | do not copy | Variable import/setup helpers can touch secrets. Use manual dashboard/secret-manager guidance instead. |
| `skills/payin-cloud/SKILL.md` | cloud-only | summarize product/ops boundaries | Useful boundaries: hosted Cloud service, sandbox checklist, launch checklist, troubleshooting order. Do not copy skill wholesale. |
| Open payment core packages and route logic | obsolete/do-not-migrate | prohibited | Must remain in `payin-open` or behind explicit Open seams; never duplicate in the layer. |

## Cloud-only assets

Cloud-only assets describe hosted deployment topology, admin static delivery, environment separation, operational runbooks, launch checklists, and Railway-style service configuration. These are appropriate to represent in `payin-cloud-layer` as redacted examples and docs.

Created layer targets:

- `templates/deployment/railway.api.example.toml`
- `templates/deployment/railway.admin.example.toml`
- `templates/deployment/Dockerfile.admin.example`
- `docs/deployment.md`

## Open seam needed

The root API Dockerfile and several cloud-ops notes assume direct access to Open workspaces and built package internals. The layer should not copy those internals. Required seams include:

- an Open app factory/package export for hosted API composition;
- documented configuration contracts for chain/provider settings;
- migration/database initialization commands exposed as safe Open package scripts;
- health and readiness endpoints that the hosted layer can probe without reimplementing route logic.

## Obsolete or do-not-migrate

Reduced Docker package manifests and fast deploy helpers should not become canonical templates. They are either historical, too workspace-specific, or likely to encourage copying internal package graphs into the Cloud layer.

## Secret handling

Do not migrate values from `.env*`, Railway dashboard variables, CLI variable exports, project IDs, tokens, API keys, database URLs, JWT/session secrets, private keys, webhook secrets, or provider credentials. New templates use placeholders such as `${{API_BASE_URL}}` and comments that direct operators to secret storage.
