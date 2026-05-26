# Superseded: R9 production-readiness hardening gate

R9 was the earlier live-production blocker framing. R10 supersedes it for the current Railway production-capability proof environment.

Use `docs/production-readiness-r10.md` and `npm run production-readiness:check` for the active gate. The current scope is not live production approval: billing/payment integration, real email delivery, third-party OAuth, and existing production data migration are non-goals.
