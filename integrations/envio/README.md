# Envio exchange activity

Real Envio HyperIndex 3.12.1 handlers ingest selected Perpl Exchange events from Monad public RPC into PostgreSQL 17.9. This module contains no signing keys, wallet connection, account creation, trade dispatch, paid service or hosted deployment.

## Data flow

Public Monad RPC → Envio HyperIndex → `ExchangeEvent` + `envio_chains` PostgreSQL tables → read-only repeatable-read SQL transaction → atomic local JSON read model → `src/data/envio.ts` → `/api/activity`.

The app never reads the evidence examples as a live feed. `.runtime/` is ignored and contains current snapshots and the private local database only. Without a fresh snapshot, the app reports `status: unavailable`, `watermark: null` and no events. A valid empty index returns `status: live` with an empty array.

Watermark is Envio's committed `progress_block`, not the greatest returned event or independently queried RPC head. The snapshot also carries Envio's source block and progress block timestamp. Snapshots older than 120 seconds or chain progress older than five minutes fail closed. Historical backfill therefore stays unavailable until fresh enough.

## Run locally

Requires Node ≥24. Linux x64 and macOS arm64 startup/indexing have been exercised; current public RPC reliability still controls freshness. `embedded-postgres` selects a packaged binary for the host platform. From this directory:

```sh
npm ci --cache /tmp/mandate-npm-cache
npm run codegen
npm run typecheck
npm start
```

`npm start` runs PostgreSQL as the current non-root user on loopback TCP port 5439, Envio on loopback port 9899, and exports snapshots every five seconds. No Docker, daemon installation, OS user creation or privileged operation is needed. The `local-development-only` database password is an isolated local development value, not an external credential. Hasura is explicitly disabled; there is no public GraphQL endpoint. Envio's default health/metrics listener belongs to the local process; do not expose these ports outside a trusted development environment.

The supervised command keeps all processes together, which also works when separate shell commands have isolated network namespaces. The application reads only atomically renamed files and needs no database credentials. Stop gracefully with `touch .runtime/stop` and wait for the supervisor to exit (within its five-second export interval). Restart with `rm -f .runtime/stop && npm start`. This is a temporary foreground development process, not an installed service; it is not guaranteed to survive the executor/session closing. Repeated starts resume Envio checkpoints; they do not clear existing state. Do not run two supervisors against this database directory.

The supervisor also closes its owned indexer, SQL connection and PostgreSQL instance after a later startup failure. An unexpected indexer exit returns a nonzero status instead of reporting a successful stop. Stop signals interrupt the export wait; bounded cleanup continues if one resource fails to close. A stop marker must be removed explicitly before resuming the selected window. Cleanup never deletes database or checkpoint files, and only the supervisor's own child is signalled.

The included start blocks are the verified October 1, 2026 run's beginning: mainnet 109565000; testnet 67214000. This is recent-window activity, not a claim of complete exchange history. To start a separate fresh window later, choose a new local runtime/database directory and explicitly update start blocks. Never claim the window includes earlier activity.

Monad's public RPC allows at most 100 blocks per `eth_getLogs` request. Configuration caps both initial and maximum range at 100 with zero acceleration. RPC sync does not require an Envio HyperSync token.

## Event meaning

Selected events: OrderRequest/V2, MakerOrderFilled/V2, TakerOrderFilled/V2, PositionClosed, PositionDecreased.

- Event primary key: chain ID + transaction hash + log index; repeat handler/preload writes are idempotent
- Full decoded values are canonical JSON with bigint values as exact decimal strings
- `quantity` is integer lot units from `lotLNS`; PositionDecreased uses `startLotLNS - endLotLNS`; PositionClosed has no ABI quantity and stays null
- Taker fill events do not include market/account IDs; those values remain null rather than inferred from neighboring logs
- An OrderRequest log is a request observation, not proof of a successful fill
- Activity is public exchange activity, not a claim about the user's holdings or rehearsal execution
- Envio retains its normal checkpoint/reorg handling; the read-only SQL export observes events and watermark in one transaction

## Verification

From the repository root: `node --test tests/envio.test.ts`. From this directory: `npm run typecheck` and, while the indexer is running, `node scripts/verify-evidence.mjs`.

The cross-check independently fetches one already-indexed receipt per network and decodes it using the official ABI. It compares every normalized field with the Envio entity; it never inserts chain data or modifies the read model. Saved files in `evidence/` are historical proof only.

## Provenance and documentation

- Official [Perpl Exchange ABI](https://github.com/PerplFoundation/dex-sdk/blob/01b9910761755b0a0d9c710c1ede62ab937daa7d/crates/sdk/abi/dex/Exchange.json); the committed ABI is the `abi` array from that artifact, not bytecode
- [Mainnet context](https://app.perpl.xyz/api/v1/pub/context): chain 143, exchange `0x34b6552d57a35a1d042ccae1951bd1c370112a6f`
- [Testnet context](https://testnet.perpl.xyz/api/v1/pub/context): chain 10143, exchange `0x1964c32f0be608e7d29302aff5e61268e72080cc`
- [Envio configuration](https://docs.envio.dev/docs/HyperIndex/configuration-file)
- [Envio handlers and preload semantics](https://docs.envio.dev/docs/HyperIndex/event-handlers)
- [Envio environment variables, external RPC and disabled Hasura](https://docs.envio.dev/docs/HyperIndex/environment-variables)
- [Embedded PostgreSQL npm source](https://github.com/leinelissen/embedded-postgres)

## Recent window on Mac

`npm run start:recent` obtains public RPC heads once, starts 200 blocks before each, records the exact window in `.runtime/recent/window.json`, and uses a separate PostgreSQL directory and SQL schema. Subsequent starts resume that window, preserving the original October 1 backfill. Run only one supervisor at a time (both modes use ports 5439/9899).

Stop recent mode with `touch .runtime/recent/stop`; resume with `rm -f .runtime/recent/stop` then `npm run start:recent`. Standard mode still uses `.runtime/stop`. Both modes export to `.runtime/{mainnet,testnet}.json`, which the app validates for freshness. Restarting a days-old recent window still requires catch-up; it does not silently reset history.

The nested config resolves schema and ABI relative to its own directory, while Envio resolves the handler relative to the project directory. The supervisor preloads `scripts/loopback-only.mjs` only in its Envio child because 3.12.1 ignores `ENVIO_INDEXER_HOST` and otherwise binds its health listener on all interfaces. No OS firewall or dependency source is changed. `lsof -nP -iTCP:9899 -sTCP:LISTEN` verifies the actual binding.

For cross-check output without replacing historical artifacts: set `EVIDENCE_DIR` to an existing absolute directory before running `node scripts/verify-evidence.mjs`. RPC timeouts and stale source blocks remain unavailable, never success.

## Explicit named recent windows

To create or resume a distinct real recent window, run `npm run start:recent -- --window oct04-live`. The short validated tag selects `.runtime/recent-oct04-live` and its own PostgreSQL schema/database. The original `.runtime/recent` and its checkpoint are preserved. Creation records real public RPC heads and head-minus-200 start blocks; the same name resumes those blocks instead of resetting history. Stop that window with `touch .runtime/recent-oct04-live/stop`; remove only that stop marker before resuming. Only one supervisor may bind ports 5439/9899. Atomic snapshots include the actual window start, and the UI exposes that bound rather than implying complete history.
