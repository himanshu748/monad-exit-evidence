# Verified October 1, 2026 run

These are historical verification artifacts, never app inputs. The app reads only `.runtime/{mainnet,testnet}.json` from the running Envio SQL exporter, with strict timestamp and provenance checks.

## Commands and outcomes

| Command | Outcome / evidence |
| --- | --- |
| `npm install --cache /tmp/mandate-npm-cache` in this integration | Installed 258 packages; pinned HyperIndex 3.12.1 and PostgreSQL 17.9 binary. `install.txt` preserves transitive Fuel engine/deprecation warnings; these EVM-only runs succeeded on Node 24.19.0 |
| `node --test tests/envio.test.ts` at root before implementation | Six intended missing-feature failures from explicit stubs, `tests-red.txt` |
| Added atomic local snapshot reader test, reran | Intended unavailable-versus-live assertion failed, `local-snapshot-red.txt` |
| Added corrupt quantity / missing field tests, reran | Two intended validation failures, `provenance-red.txt` |
| `npm run codegen` | Exit 0, `codegen.txt` |
| `npm run typecheck` inside integration | Exit 0, `typecheck.txt` |
| `node scripts/run-local.mjs` | Started unprivileged loopback PostgreSQL, genuine Envio RPC indexing, and SQL export. Continuing realtime session; `runtime-log.txt` / `indexer-log.txt` |
| `node --test tests/envio.test.ts` final | 13 passed, 0 failed; `tests-green.txt` |
| `npm test` at root | 55 passed, 0 failed at verification time; `suite.txt` |
| `npm run typecheck` at root | Exit 0, `root-typecheck.txt` |
| `node scripts/verify-evidence.mjs` | Independently fetched one receipt per chain; all decoded fields and chain/contract/block/log provenance matched actual Envio entities, `receipt-cross-check.json` and `.txt` |
| Call `getEnvioActivity` for both networks | Both returned live with fresh committed watermarks and 50 real events each; `live-adapter.json` |

The final `indexer-log.txt` includes Envio's explicit all-chains-caught-up and switching-to-realtime messages at 09:07:21 UTC. At 09:07:27 UTC, mainnet had processed 54,515 selected events through block 109568126; testnet had processed 33,398 through block 67217362. Later fresh watermarks are in the saved JSON snapshots. This is selected recent-window activity, not a full-history index.

## Runtime issues encountered and resolved

1. The default Unix-domain PostgreSQL socket could not be created in this executor. Loopback TCP-only startup (`-h 127.0.0.1 -k ''`) succeeded. No permissions or OS security settings were changed.
2. Different exec commands have separate process/network namespaces. The final supervisor starts its own database, Envio child, and SQL exporter together; the application reads their shared atomic files.
3. Public Monad RPC rejects `eth_getLogs` ranges greater than 100 blocks. The final config uses `initial_block_interval: 100`, `interval_ceiling: 100`, and `acceleration_additive: 0`.
4. Public RPC transient 429 responses occurred during backfill. Envio retried with backoff and both chains reached realtime. No provider accounts or paid upgrades were used. Future upstream failures correctly age the read model into unavailable.

`receipt-cross-check.json` is an independent read-only cross-check, not a separate source for activity. No replay event is inserted into the Envio database or production snapshots. The only writes to `ExchangeEvent` originate in the Envio event handler.

A later independent decode exposed a representation mismatch for small integer ABI types (Envio bigint versus viem number). `abi-type-red.txt` captures the failing regression; all safe decoded integer values now canonicalize to strings. The final cross-check was rerun successfully. Historical failed cross-check output is retained in `abi-type-cross-check-failure.txt`.

At 09:10:25 UTC, `touch .runtime/stop` was tested: supervisor exited 0 and PostgreSQL logged a completed shutdown. `rm -f .runtime/stop && npm start` restarted the foreground pipeline from existing checkpoints for immediate app verification. Its continued availability depends on this development session; it is not a permanent service.
