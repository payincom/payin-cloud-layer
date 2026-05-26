# Open Runtime Contract Consumption

PayIn Cloud Layer composes PayIn Open without owning or copying payment core internals.
The stable type surface is `@payin/app/runtime-contract`; the runtime factory remains `createApp` from `@payin/app/server`.

## Open-owned

- Payment core, Open route implementation, default manager/auth/runtime wiring, and policy seam definitions.
- `PAYIN_OPEN_RUNTIME_CONTRACT` metadata and the stable exported composition types.

## Cloud-owned

- Hosted tenant/auth/entitlement policy, Cloud-only route guard behavior, control-plane routes, admin/status routes, and local deterministic policy providers.
- Consumer-side checks that reject imports from Open internals or broad app-factory type indexing.

## Shared Contract

Cloud may consume `OpenRuntimeCompositionOptions`, `OpenRuntimeRouteDependencies`, `OpenCloudOnlyRouteGuard`, `OpenManagerProvider`, and policy seam types from `@payin/app/runtime-contract`.
Cloud should only import `createApp` from `@payin/app/server`; all other Open consumer types should come from the stable contract export.

## Versioning And Evolution

- Additive optional contract fields are safe within the current major version.
- Breaking route dependency, hook, guard, or policy decision changes require a major contract version bump and a coordinated Cloud migration.
- Consumer validation must pass before Cloud accepts Open contract changes.

## Release Packaging Follow-up

The current workspace uses `file:../payin-open/apps/api` for local validation.
A future release step should replace that with an immutable package or internal registry artifact so Cloud builds against a pinned Open contract version.
