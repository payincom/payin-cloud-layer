# Open app export seam

Status: hardened into an explicit runtime composition contract.

`payin-open/apps/api/package.json` exposes two Cloud-consumable subpath exports:

```json
{
  "name": "@payin/app",
  "exports": {
    "./server": {
      "types": "./dist/server.d.ts",
      "import": "./dist/server.js"
    },
    "./runtime-contract": {
      "types": "./dist/runtime-contract.d.ts",
      "import": "./dist/runtime-contract.js"
    }
  }
}
```

The Cloud layer keeps one runtime import for the app factory and gets consumer types from the stable contract surface:

```ts
import { createApp } from '@payin/app/server';
import type { OpenRuntimeCompositionOptions } from '@payin/app/runtime-contract';
```

The Open package should keep payment core in `packages/processor`, `packages/manager`, and `packages/auth`; the Cloud layer should only compose exported runtime seams and add hosted policy, admin, deployment, billing, and organization UX.
