# Bounty candidates and proof packet

This packet covers **Best Use of Envio**, **Best use of Perpl's API**, and **Best Analytics / Risk Tool**. Envio is the strongest demonstrated integration. Both Perpl awards are candidates pending their detailed signed-in requirements; no sponsor eligibility or completed entry is claimed. CRE is omitted by user choice. Nansen remains access-required and has no meaningful live product integration.

## Rules provenance

The [official public Metropolis page](https://monad.xyz/developers/hackathons/metropolis) was checked on October 4, 2026. It lists these three awards and associates both Perpl candidates with Perpl. Detailed Envio and shared submission requirements below come from the authorized October 3 portal review. An anonymous October 4 read of the portal's normal catalog endpoint returned HTTP 401; the exact Perpl criteria, full current catalog, selection restrictions and changes remain unresolved. Public descriptions are not substitutes for detailed eligibility rules.

## Draft sponsor descriptions

### Best Use of Envio

Exit Evidence Workbench uses Envio HyperIndex to ingest selected real Perpl Exchange events on Monad mainnet and testnet. Idempotent handlers normalize event provenance and exact integer quantities into PostgreSQL entities. The app consumes atomic read-model exports from a repeatable-read transaction that captures events and Envio's committed chain watermark together. Source timestamps, progress age, chain/contract binding, duplicate consistency and decoded quantities are checked before activity is shown. A stopped or lagging pipeline yields an explicit unavailable state. An independent public receipt decoder checks indexed fields without modifying the read model.

Useful result: public request, fill and position-decrease observations have inspectable provenance. The transaction inspector compares complete normalized indexed records with independently fetched receipts/canonical blocks, including block hash, timestamp and every decoded parameter. Missing or stale data remains unavailable. These are public participant events, not viewer ownership or app execution.

Proof references: [config](../integrations/envio/config.yaml), [schema](../integrations/envio/schema.graphql), [handlers](../integrations/envio/src/EventHandlers.ts), [supervisor](../integrations/envio/scripts/run-local.mjs), [client adapter](../src/data/envio.ts), [independent decoder](../integrations/envio/scripts/verify-evidence.mjs), and [event tests](../tests/envio.test.ts).

Remaining: sustain a fresh pipeline, expose the approved live product and required source/evidence, and verify the current bounty form. Historical examples establish prior ingestion; they are not a live data fallback.

### Best use of Perpl's API — eligibility pending

The workbench reads actual Perpl public market configuration and order books on Monad mainnet and testnet. These reads drive market selection, exact price/quantity display and quoted-depth analysis only for amounts entered by the user. Quote display needs no sample position or default quantity. Stale market configuration or book timestamps invalidate usable context. All provider operations are public reads; no account credentials, orders or trading writes are used.

Proof references: [API adapter](../src/data/perpl.ts), [adapter tests](../tests/data.test.ts), [browser smoke](../web/tests/browser-smoke.mjs), and the actual-product technical recording described in [recorded media](recorded-media-2026-10-03.md).

Remaining rules questions: are public read-only API features sufficient, must the app execute real orders, which network/primary track qualifies, and what sponsor-specific proof or video is required? Do not assume answers or add trading to satisfy an unknown rule.

### Best Analytics / Risk Tool — Perpl, eligibility pending

The product calculates visible book depth for a user-entered amount using actual public quotes. It then independently decodes real public exchange transactions and compares the complete normalized receipt/log record with Envio. Exact lot quantities, unknown ABI fields, block hashes and timestamps remain inspectable. A transaction missing from the current exported page is distinguished from a source mismatch, and stale providers remain unavailable. Observations export unchanged with a change-detection digest.

Proof references: [public book/depth adapter](../src/data/perpl.ts), [real receipt reader](../src/data/observations.ts), [complete indexed-event adapter](../src/data/envio.ts), and [real integration browser checks](../web/tests/browser-smoke.mjs).

Limits: no connected-account exposure, liquidation/portfolio risk, owner-authenticated approval or app execution is established. Public quotes are not guaranteed fills. Legacy simulated execution routes are disabled; historical rehearsal footage is not current proof. The sponsor's definition of analytics/risk must be checked before selecting this award.

## Gather current data proof

Run from the repository root with Node 24 or newer:

```sh
npm --silent run bounty:evidence > /tmp/monad-bounty-evidence.json
```

The command reads real public Perpl APIs and current local Envio snapshots. It needs no application server, sample quantity, token, wallet or paid service and never starts/resets an indexer. It writes JSON to stdout only; the shell redirection chooses a local destination. Errors remain unavailable rather than becoming fixture results. `demoDataReadyNetworks` lists networks where **both** Perpl reads and the validated Envio activity are currently live. Exit code 1 means no such network is ready; exit code 0 concerns current data only. `submissionReady` remains false because hosting, rules, publication and participant fields are not established by this command.

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

Use the new real-integration recording described in [current validation](real-integration-validation-2026-10-04.md). October 1–3 rehearsal videos are historical. General and sponsor-specific duration limits still need the current portal check; no successful CRE CLI simulation or live Nansen feature should be narrated.

## Before selecting candidates in the portal

- [ ] Confirm exactly one primary track and its current eligibility criteria.
- [ ] Read the two Perpl bounty descriptions, requirements, deliverables and track/network restrictions from the signed-in portal.
- [ ] Check whether these bounties can be combined in one entry.
- [ ] Keep current Perpl/Envio proof and a sustained accessible product available to judges.
- [ ] Resolve the prior publication approval hold before public source, hosting or video uploads.
- [ ] Supply accurate team/contact/ownership information and personally accept the agreements.

All descriptions above are local draft copy. This packet does not create or alter a portal entry.
