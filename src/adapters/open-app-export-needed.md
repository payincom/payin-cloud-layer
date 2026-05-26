# Open app export seam

Status: resolved locally for the spike follow-up.

`payin-open/apps/api/package.json` now exposes a stable subpath export:

```json
{
  "name": "@payin/app",
  "exports": {
    "./server": {
      "types": "./dist/server.d.ts",
      "import": "./dist/server.js"
    },
    "./package.json": "./package.json"
  }
}
```

The Cloud layer now depends on the local Open API package:

```json
{
  "dependencies": {
    "@payin/app": "file:../payin-open/apps/api"
  }
}
```

The adapter imports through the package seam instead of a sibling build path:

```ts
import { createApp, type CreateAppOptions } from '@payin/app/server';
```

The Open package should keep payment core in `packages/processor`, `packages/manager`, and `packages/auth`; the Cloud layer should only compose exported app/route seams and add hosted policy, admin, deployment, billing, and organization UX.
