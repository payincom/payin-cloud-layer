# Railway proof testnet config

Use an easy Ethereum Sepolia-style testnet for the R10 proof environment. The Cloud layer does not need live payment settlement for this slice; testnet variables only prove that hosted configuration is separated from code and safe to operate.

## Defaults

- Network label: `sepolia`.
- Chain ID: `11155111`.
- RPC URL: set through Railway variables only; do not commit or print it.
- Payment/billing provider: disabled for R10.
- Email provider: disabled; simulated email login creates sessions without sending mail.
- OAuth providers: disabled unless a future slice adds real provider credentials.

## Suggested Railway variables

- `PAYIN_CLOUD_CONTROL_PLANE_STORAGE=postgres`
- `PAYIN_CLOUD_CONTROL_PLANE_NAMESPACE=railway-proof`
- `PAYIN_CLOUD_POSTGRES_SSL=true`
- `PAYIN_CLOUD_PROOF_NETWORK=sepolia`
- `PAYIN_CLOUD_PROOF_CHAIN_ID=11155111`
- `PAYIN_CLOUD_PROOF_RPC_URL` set as a secret-like Railway variable
- `PAYIN_CLOUD_POLICY_MODE=enforce`

`DATABASE_URL` is created by Railway Postgres and must be consumed only by runtime/migration commands. Do not echo it in logs.
