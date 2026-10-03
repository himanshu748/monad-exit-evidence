# Verification record — 1 October 2026

## Passed
- 60 Node backend/integration tests at this checkpoint
- 26 React/form tests
- Root TypeScript check, frontend production build, real Envio codegen/typecheck and real CRE SDK typecheck
- Live Perpl mainnet market-context and 100-level BTC order-book reads through the implemented adapter
- Envio HyperIndex 3.12.1 ingestion on mainnet and testnet into isolated PostgreSQL 17.9, both reaching realtime
- Envio committed-watermark snapshots consumed through the app adapter; missing/stale/corrupt data fails closed
- Independent direct-RPC receipt decoding matched an Envio-indexed event on each network
- Graceful Envio stop and checkpoint restart

Exact Envio commands, checkpoints and source attribution: [Envio evidence](../integrations/envio/evidence/README.md).

## Blocked or not performed
- Successful CRE CLI simulation: official CLI 1.35.0 reports authentication required. No login or new credential was created
- Live Nansen usage: no authorized account transport available. Only parser/policy fixtures and error behavior tested
- Browser QA passed on Mac October 1 and October 3; historical cloud restrictions do not describe the current Mac results. Fresh screenshots were inspected; this remains bounded smoke validation.
- Public GitHub repository, public product hosting, Monad testnet deployment, wallet signatures, trade activity and submission videos: not performed

The generated visual concept is a design reference, not an application screenshot. Test logs are historical evidence, not a claim that a stopped service stays live. Run the documented commands against the final source before release.

## Independent review and corrections
A separate reviewer inspected commit dce8776 and reproduced seven gaps beyond the original passing suite. Regression tests first failed for policy-digest binding, Nansen pagination completeness, collateral precision, truthful runtime health, lost-response refresh, stale UI data and superseded verification results. Fixes passed the full suites. An additional missing-predicate receipt regression was also corrected. No independent review is presented as a security audit.

## October 3 continuation

See [current readiness](local-completion-2026-10-03.md) and `evidence/2026-10-03/` for fresh checks. Historical Envio snapshots above do not imply a live Mac indexer. No remote push, upload, public deployment or submission occurred.
