# Deploying the HyperIndex indexer to Envio Cloud

**Status: not deployed yet.** This page is a runbook. The live app currently reads Envio through on-demand HyperSync (see [hosted HyperSync mode](mac-independent-hypersync.md)), which already works without any local services. Deploying the HyperIndex indexer to Envio Cloud is an optional upgrade that gives judges a permanently running HyperIndex deployment with its own public GraphQL endpoint, instead of a Mac-only worker.

## Why this matters for the Envio bounty

- The bounty asks for "a working indexer or data pipeline built with Envio, deployed to Envio Cloud or self-hosted". Self-hosted is allowed, but the old self-hosted HyperIndex worker only ran on a laptop, so judges could never see it.
- The current HyperSync path already satisfies "HyperSync client code" with a useful consumer. A hosted HyperIndex deployment adds a second, independently queryable Envio product to show depth of use.

## What is in this repo for it

- `integrations/envio/config.cloud.yaml`: same contracts, events, schema and handlers as `config.yaml`, but with no `rpc` blocks, so Envio Cloud syncs both Monad networks (143 mainnet, 10143 testnet) through HyperSync instead of 100-block public RPC pages. Validated locally with `npx envio codegen --config config.cloud.yaml` (envio 3.12.1, exit 0).
- `integrations/envio/package.json` pins `envio` 3.12.1 (Envio Cloud needs ≥ 2.21.5, not 2.29.x).

## Exact steps (about 15 minutes)

1. **Bump the start blocks.** Perpl emits several events per block, and the free Development plan has a 100,000-event soft limit. Right before deploying, read fresh heads and put them (minus a few hundred blocks) into `config.cloud.yaml`:
   ```sh
   curl -s https://monad-exit-evidence.vercel.app/api/activity?network=mainnet | jq .data.watermark
   curl -s https://monad-exit-evidence.vercel.app/api/activity?network=testnet | jq .data.watermark
   ```
   Then check it still validates: `cd integrations/envio && npm ci && npx envio codegen --config config.cloud.yaml`.
2. **Create a deployment branch** from the commit you want hosted, e.g. `git checkout -b envio-cloud && git push -u origin envio-cloud`. Envio Cloud deploys on every push to this branch; keep `main` untouched.
3. **Log in** at https://envio.dev/app/login with GitHub (himanshu748) and pick your personal organisation.
4. **Install the "Envio Deployments" GitHub App** and grant it access to `himanshu748/monad-exit-evidence` only.
5. **Add Indexer** → select the repo, then set:
   - Root directory: `integrations/envio`
   - Config file: `config.cloud.yaml`
   - Deployment branch: `envio-cloud`
6. **Environment variables** (Settings → Environment Variables): add `ENVIO_API_TOKEN` with your HyperSync token if the build log asks for one. Only `ENVIO_`-prefixed names are accepted.
7. **Push** to `envio-cloud` (or click Deploy) and watch the build and sync logs in the dashboard.
8. **Copy the production GraphQL endpoint** from the indexer overview and test it:
   ```sh
   curl -s -X POST <ENDPOINT> -H 'content-type: application/json' \
     -d '{"query":"{ ExchangeEvent(limit: 3, order_by: {blockNumber: desc}) { id chainId kind blockNumber transactionHash } }"}'
   ```
9. **Add the endpoint to the README** ("Demo and links" table) and to the Envio bounty answer in the submission form, labelled as the hosted HyperIndex deployment.

## Known risks, so nobody is surprised

- **Build tool:** Envio Cloud installs with pnpm 10.32. `integrations/envio/package.json` uses npm-style `overrides`; if the build fails on dependency resolution, mirror them under `"pnpm": { "overrides": { ... } }` on the deployment branch. The `embedded-postgres` dependency is only for the local supervisor and is not needed on Envio Cloud; remove it on the deployment branch if the install is slow or fails.
- **Free plan lifetime:** Development deployments are deleted after 30 days, and breaching the 100,000-event soft limit starts a 7-day grace period, then 3 days read-only, then deletion. Judging runs 14 to 27 October, so deploy close to the deadline with recent start blocks, or ask Envio in their Discord (https://discord.gg/envio) for a hackathon production allowance. Envio said publicly during Metropolis that teams can reach out with their contract address for indexing help.
- **The app does not read this endpoint yet.** `/api/activity` uses HyperSync (`ENVIO_DATA_SOURCE=hypersync`) or the local snapshot. Pointing the app at the GraphQL endpoint would need a new reader in `src/data/`; do not describe the app as reading from Envio Cloud unless that reader exists and is tested.
- Every push to the deployment branch re-indexes from the start block, and the previous version keeps serving until the new one catches up.

Sources: [Envio Cloud overview](https://docs.envio.dev/docs/HyperIndex/hosted-service), [deployment guide](https://docs.envio.dev/docs/HyperIndex/hosted-service-deployment), [pricing and fair use](https://docs.envio.dev/docs/HyperIndex/hosted-service-billing), checked 8 October 2026.
