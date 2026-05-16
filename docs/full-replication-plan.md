# PayIn Cloud Layer Full Replication Plan

This is the driving plan for rebuilding PayIn Cloud functionality inside `payin-cloud-layer` as a clean overlay over PayIn Open/shared payment core.

## Goal

Recreate all PayIn Cloud business capabilities in `payin-cloud-layer` without turning PayIn Open into a Cloud fork and without directly moving old Cloud route/database coupling into the overlay boundary.

Final state:

```text
PayIn Open/shared core
  -> payin-cloud-layer contracts + adapters
    -> PayIn Cloud hosted runtime/API/dashboard/billing/ops
```

## Non-negotiable rules

1. Do not modify the old Cloud repo `/data/openclaw/workspace/payin` during extraction work. It is read-only reference until an explicit integration step is approved.
2. Do not put Cloud-only code back into `payin-open`.
3. Every extracted Cloud capability starts with contract tests.
4. No raw secrets in contracts, docs, logs, tests, or fixtures. Use secret refs.
5. Every Cloud business operation must have explicit tenant context.
6. Entitlement checks must happen before backend side effects.
7. Billing/audit hooks must run after successful business operations; default compliance mode is strict unless a best-effort queue/retry strategy is explicit.
8. Cross-tenant access must be impossible by contract tests before adapter implementation.

## Source inventory to replicate

Reference-only old Cloud sources:

- `/data/openclaw/workspace/payin/packages/auth/src/types/organizations.ts`
- `/data/openclaw/workspace/payin/packages/auth/src/organization-manager.ts`
- `/data/openclaw/workspace/payin/packages/auth/src/middleware/audit-middleware.ts`
- `/data/openclaw/workspace/payin/apps/api/src/routes/organizations.ts`
- `/data/openclaw/workspace/payin/apps/api/tests/multi-tenant-api.test.ts`
- `/data/openclaw/workspace/payin/apps/api/tests/multi-tenant-http-e2e.test.ts`
- `/data/openclaw/workspace/payin/apps/api/tests/payment-links-api.test.ts`
- `/data/openclaw/workspace/payin/apps/api/tests/address-pool-summary-api.test.ts`
- `/data/openclaw/workspace/payin/packages/notification/tests/webhook-notifier.test.ts`

More old Cloud files should be added to this list as they are discovered.

## Current completed foundation

- Tenant context normalization and validation.
- Cloud manager overlay for orders, payment links, API keys, address pool, and webhooks.
- Entitlement provider contract and static test implementation.
- Billing usage reporter and audit logger contracts.
- Tenant resolver and active membership contract.
- Hosted config provider skeleton.
- Organization roles/plans/membership contracts.
- API key authentication/authorization boundary.
- Unit verification currently covers 5 test files / 27 tests.

## Phase 1 — Boundary completeness

### 1A. Hosted tenant config contract

Replicate Cloud-hosted runtime config semantics:

- plan type: `free`, `pro`, `enterprise`
- monthly order limits
- enabled chains/tokens
- payment-link limits
- address-pool limits
- webhook endpoint limits
- API key limits
- secret refs for webhook/RPC/provider credentials
- config merge policy between platform defaults and tenant overrides

Tests:

- free/pro/enterprise defaults are deterministic
- tenant overrides cannot include raw secret values
- enabled chain/token lookups are tenant-scoped
- limit checks return typed allow/deny results
- config provider rejects tenant mismatch

### 1B. API key/auth boundary

Completed initial contract. Expand later with:

- key creation request validation
- key rotation contract
- hashed secret verifier adapter contract
- per-key capability narrowing
- audit hooks for create/revoke/rotate/use

### 1C. Tenant/member/org management boundary

Contracts for:

- create organization
- update organization
- invite/add member
- update member role/status
- verify active membership
- ownership transfer semantics if still needed

Tests:

- owner/admin/member/viewer permissions
- pending/suspended members cannot access runtime APIs
- owner-only operations are protected
- organization slug generation/uniqueness is adapter-owned, not core contract-owned

## Phase 2 — Core hosted payment features

### 2A. Orders

Replicate multi-tenant order behavior over shared core:

- create/list/get order
- cross-tenant isolation
- payment page derivation
- order status summary
- monitor readiness dependency

Tests:

- tenant A cannot read tenant B order
- create order records usage and audit after backend success
- failed entitlement prevents backend call and usage event

### 2B. Deposits and address pool

Replicate:

- bind/unbind deposit address
- get user deposit address
- import address pool
- address pool availability/summary
- protocol-specific limits

Tests:

- address pool operations are tenant-scoped
- import respects plan limits
- no cross-tenant address reuse unless explicitly supported by adapter policy

### 2C. Payment links

Replicate:

- create/update/publish/archive payment links
- public payment link checkout
- inventory reservation
- payment-link orders

Tests:

- admin APIs require tenant auth
- public checkout only exposes published link fields
- inventory cannot over-reserve
- generated orders inherit payment link tenant

### 2D. Webhooks/notifications

Replicate:

- webhook endpoint management
- test webhook delivery
- signed payload contract
- retry policy contract
- event subscription filter contract

Tests:

- secret refs only, no raw secret leakage
- delivery/test is tenant-scoped
- audit + usage hooks fire after success

## Phase 3 — SaaS operations

### 3A. Billing/metering

Contracts for:

- usage event ingestion
- monthly aggregation
- plan entitlement resolver
- billing customer/subscription refs
- invoice period snapshots

Tests:

- usage deduplication key behavior
- usage only records after successful business operation
- strict/best-effort side-effect semantics

### 3B. Audit/risk/support

Contracts for:

- audit log events
- actor/api-key/user context
- risk decision provider
- support impersonation/access grants if required

Tests:

- sensitive fields redacted
- audit event emitted for privileged operations
- support access is explicit and time-bound

### 3C. Hosted runtime operations

Contracts for:

- tenant health/readiness
- chain/token readiness
- monitor status
- config diagnostics
- Cloud smoke checks

Tests:

- readiness summaries are tenant-scoped
- missing required config produces actionable failures

## Phase 4 — Adapter migration

Only after contracts are stable:

1. Add adapter interfaces around old Cloud DB/API behavior.
2. Implement adapters one capability at a time.
3. Keep old `/data/openclaw/workspace/payin` untouched until an explicit integration phase.
4. Prefer new adapter tests with fake repositories before live DB tests.
5. Later, add integration tests against a disposable DB/runtime.

## Phase 5 — Final parity and cutover readiness

Definition of done:

- All old Cloud business capabilities have equivalent contracts and tests in `payin-cloud-layer`.
- All Cloud tenant/auth/config/billing/audit/payment/webhook behavior has regression coverage.
- `npm run verify` passes locally and in GitHub Actions.
- No direct imports from `/data/openclaw/workspace/payin` or old Cloud workspace packages.
- `payin-open` remains Cloud-free except shared public core APIs.
- A parity matrix maps old Cloud routes/features to new Cloud layer contracts/adapters.

## Execution loop

For each slice:

1. Read old Cloud source/tests as reference only.
2. Add/extend a parity section in this plan if needed.
3. Write failing contract tests in `payin-cloud-layer`.
4. Implement minimal standalone contract/interface/helper code.
5. Run `npm run verify`.
6. Commit and push.
7. Check GitHub Actions.
8. Record progress in memory.
9. Continue to the next highest-priority unchecked slice.
