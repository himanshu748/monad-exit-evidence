# Submitted bounty and proof packet

Envio — Best Use of Envio is the sole submitted bounty, under Trust, Identity & AI Infrastructure. The existing entry was verified Ready for judging on October 9; see the [submission receipt](submission-receipt-2026-10-09.md). The authenticated October 4 [catalog](https://hackathon.monad.xyz/api/v1/catalog) resolved the detailed criteria: the current product does not satisfy either Perpl bounty. [Current rules and fit](hackathon-rules-2026-10-04.md) records the exact deliverable gaps. CRE is omitted; Nansen has no authorized live integration.

## Integration descriptions and excluded candidates

### Best Use of Envio

The deployed workbench uses Envio HyperSync client code to discover real Perpl Exchange events on Monad mainnet and testnet. Its bounded 16-block query requires complete block coverage and strictly normalizes event provenance and exact ABI quantities. The watermark is the last fully queried block, not a PostgreSQL committed checkpoint. Source timestamps, chain/contract binding, block/log joins, duplicate consistency and decoded values are checked before activity is shown. Missing or stale reads remain unavailable, with no RPC-log or fixture fallback. Older targets query their actual block separately and are compared with independently fetched Monad receipts/canonical blocks.

The optional historical HyperIndex path retains idempotent handlers, PostgreSQL entities and atomic repeatable-read exports with committed chain progress. It is preserved for local use; the October 7 hosted proof succeeded with this project's Mac worker, database and local application stopped.

Useful result: public request, fill and position-decrease observations have inspectable provenance. The transaction inspector compares complete normalized indexed records with independently fetched receipts/canonical blocks, including block hash, timestamp and every decoded parameter. Missing or stale data remains unavailable. These are public participant events, not viewer ownership or app execution.

Proof references: [HyperSync client](../src/data/envio-hypersync.ts), [source adapter](../src/data/envio.ts), [application receipt comparison](../src/data/observations.ts), [public historical verifier](../scripts/verify-mac-independent.mjs), and [dated hosted proof](publication-validation-2026-10-07.md). Retained HyperIndex references: [config](../integrations/envio/config.yaml), [schema](../integrations/envio/schema.graphql), [handlers](../integrations/envio/src/EventHandlers.ts), [supervisor](../integrations/envio/scripts/run-local.mjs), [local direct RPC decoder](../integrations/envio/scripts/verify-evidence.mjs), and [event tests](../tests/envio.test.ts).

The narrated hosted demonstration and Envio explanation were saved in the existing entry on October 9. The subsequent [cache improvement](lookup-cache-validation-2026-10-09.md) reduces repeated provider reads; availability remains subject to provider quotas. Historical examples establish prior ingestion; they are not a live data fallback.

### Best use of Perpl's API — requirements not satisfied

The workbench reads actual Perpl public market configuration and order books on Monad mainnet and testnet. These reads drive market selection, exact price/quantity display and quoted-depth analysis only for amounts entered by the user. Quote display needs no sample position or default quantity. Stale market configuration or book timestamps invalidate usable context. All provider operations are public reads; no account credentials, orders or trading writes are used.

Proof references: [API adapter](../src/data/perpl.ts), [adapter tests](../tests/data.test.ts), [browser smoke](../web/tests/browser-smoke.mjs), and the actual-product technical recording described in [recorded media](recorded-media-2026-10-03.md).

The authenticated criteria require a production-ready bot/automation system with real execution, risk management and profitability. Current public reads do not satisfy this. Third-party events are not execution by this app; no trading may be added without separate authorization.

### Best Analytics / Risk Tool — requirements not satisfied

The product calculates visible book depth for a user-entered amount using actual public quotes. It then independently decodes real public exchange transactions and compares the complete normalized receipt/log record with Envio. Exact lot quantities, unknown ABI fields, block hashes and timestamps remain inspectable. A transaction missing from the current exported page is distinguished from a source mismatch, and stale providers remain unavailable. Observations export unchanged with a change-detection digest.

Proof references: [public book/depth adapter](../src/data/perpl.ts), [real receipt reader](../src/data/observations.ts), [complete indexed-event adapter](../src/data/envio.ts), and [real integration browser checks](../web/tests/browser-smoke.mjs).

Limits: no connected-account exposure, liquidation/portfolio risk, owner-authenticated approval or app execution is established. Public quotes are not guaranteed fills. Legacy simulated execution routes are disabled; historical rehearsal footage is not current proof. The current criteria require extensive protocol metrics and wallet position/history/statistics/margin/watch views. These are absent; do not select this award for the current inspector.

## Gather current data proof

Run from the repository root with Node 24.x:

```sh
npm --silent run bounty:evidence > /tmp/monad-bounty-evidence.json
```

The command reads real public Perpl APIs and the configured Envio source. Default local HyperIndex needs fresh snapshots and no token; explicitly selected HyperSync requires authorized server-side `ENVIO_API_TOKEN` supplied securely through the environment. It needs no application server, sample quantity, wallet or paid service and never starts/resets an indexer. It writes JSON to stdout only; the shell redirection chooses a local destination. Errors remain unavailable rather than becoming fixture results. `demoDataReadyNetworks` lists networks where **both** Perpl reads and validated Envio activity are live at the check. Exit code 1 means no such network is ready; exit code 0 concerns current data only. The October 7 authenticated HyperSync run returned both networks ready and `submissionReady: false`; this command does not establish eligibility, media completion or final participant declarations.

For Envio, run one documented [recent supervisor](../integrations/envio/README.md) and allow it to catch up. Do not start a second supervisor on the same ports/database. The recorded beginning of the index window remains unchanged on restart. For independent receipt proof, from the repository root:

```sh
mkdir -p /tmp/monad-envio-proof
EVIDENCE_DIR=/tmp/monad-envio-proof node integrations/envio/scripts/verify-evidence.mjs
```

This separate receipt cross-check verifies indexed entities, including historical entities; it does not by itself establish current freshness. Keep the timestamped data report and receipt proof together. Do not overwrite historical artifacts or treat an old report as current.

## Actual-product proof sequence

1. Show actual Perpl quotes and source times. Quantity and transaction fields start empty.
2. Enter a quantity deliberately and calculate quoted depth. Explain no holdings, order or fill is inferred.
3. Select a real Envio event; show the explicit recent-window start and committed watermark.
4. Independently fetch/decode its actual receipt and canonical block, comparing complete indexed values. Export the unchanged observation and inspect real ABI fields.
5. Switch networks; inputs/evidence clear. Repeat with a real testnet event and check mobile readability.

The submitted [technical demo](https://youtu.be/Z6wp9TRV9Dw) and [pitch](https://youtu.be/wiKvrTWdOUE) are unlisted recordings of the October 7 hosted HyperSync build, with disclosed synthetic Deepgram narration and trims. They do not show the October 9 cache improvement. The [October 4 recording](real-integration-validation-2026-10-04.md) is historical HyperIndex evidence; October 1–3 rehearsal videos are also historical. No successful CRE CLI simulation or live Nansen feature should be narrated.

## Recorded portal status — October 9

- Primary track: Trust, Identity & AI Infrastructure; sole bounty: Best Use of Envio.
- Envio explanation, live/source links, technical demo, pitch, logo, description, GTM and access instructions saved.
- Existing entry verified Ready for judging after reload; dashboard 5 / 5 complete.
- Neither Perpl bounty is selected because the product does not satisfy the reviewed deliverables.
- No separate final-submit button or agreement prompt appeared. The observed status does not establish organizer eligibility, additional legal acceptance or prize entitlement.

These descriptions explain the implementation. The [dated receipt](submission-receipt-2026-10-09.md) records the portal action; the evidence command's `submissionReady: false` is not a portal-status query.
