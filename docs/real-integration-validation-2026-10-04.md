# Real integration validation — October 4, 2026

User requirement: use real integrations, without mock/sample runtime outcomes. The production rehearsal UI, default sample position quantities, simulated execution routes and legacy receipt-verification route are removed or blocked. The app now reads public Perpl quotes, actual Envio SQL activity and independently fetched public Monad receipts/canonical blocks. Transaction and quantity inputs begin empty. Missing data stays unavailable; no static evidence or fixture is returned as live data.

## Verified behavior

- Backend tests: **68/68 passed**, including actual HTTP/Perpl reads and independently fetched real historical transaction receipts on both networks. Offline calculation/negative-parser inputs are regression checks, not live integration claims.
- UI tests: **15/15 passed**. The four app workflow checks use a real local backend and actual public providers; the other eleven cover pure formatting/calculation regressions. The unused mocked UI fixture file was removed. Historical rehearsal generators were moved out of production source into `tests/legacy`; their regression checks remain offline.
- Root typecheck, UI build, Envio typecheck, format and whitespace checks pass. Dependencies are unchanged from the four zero-advisory audits earlier October 4; this does not imply a new security audit.
- Real browser capture completed `2026-10-04T08:20:57.364Z`. Both networks returned **INDEX_AND_CHAIN_MATCH** against full normalized event records, including block hash/time/decoded parameters. Exact export, network input/evidence reset and mobile 390×844 pass. Browser errors and browser mutation requests are empty; no horizontal overflow. The first recording attempt stopped at a test selector mismatch; the corrected combobox selector completed successfully without changing provider results.
- The current named Envio window has real start blocks **110413618 mainnet** and **68062524 testnet**. Both providers were live in the dated proof. This is bounded recent-window activity, not complete history. Prior databases/checkpoints are preserved and stopped; `npm --prefix integrations/envio run start:recent -- --window oct04-live` resumes this new window when no supervisor is running.
- Independent receipt decoding matches actual indexed fields on both networks. The new real transaction inspector separately checks RPC chain ID, successful receipt, canonical block, contract/log provenance and strict ABI decoding before comparing the full Envio record. Page absence is NOT_IN_CURRENT_PAGE, not a claim of absence from the indexed range.
- The separate reviewer rechecked all three review findings and **16/16 targeted tests**, typechecks and whitespace, with no remaining critical/important finding in its bounded scope. See [independent review](independent-review-2026-10-04.md).

Dated evidence directory: `/Users/himanshujha/Documents/Codex/2026-10-03/task-3/real-integration-evidence/`. Root/UI logs are sibling files `real-integrations-backend-tests.txt` and `real-integrations-ui-tests.txt`. These observations can age; the diagnostic must be rerun before a live presentation. Foreground indexer/app processes may stop when the execution session closes.

## Current real-product media

The continuous capture uses the actual product and real public provider responses. No mocked response, simulated outcome, slideshow or code walkthrough appears. Local narration uses macOS Samantha speech synthesis; no external/paid media service. Both final files are 1600×1200 H.264/AAC at 60 fps. Midpoint frames were inspected for legibility; technical narration is non-silent. General limits come from the earlier authorized portal review and sponsor-specific rules remain pending.

- `monad-real-technical.mp4`: 98.44 seconds, 6646715 bytes, SHA-256 `7a357bfaabac39c80d851a5af208969353b82e733872cb9faa9ad7b76eb9eab7`.
- `monad-real-pitch.mp4`: 66.15 seconds, 4722130 bytes, SHA-256 `81ef3b18e250dd803ee911985fea79da693624b4f9009a280cbc147383b80d8b`.

Media directory: `/Users/himanshujha/Documents/Codex/2026-10-03/task-3/monad-real-integration-media/`. Transcripts, raw-capture pointer, codec/duration metadata and hashes are in its manifest. The October 1–3 rehearsal videos are preserved as historical artifacts and superseded for the current product.

## Remaining boundaries and gates

Public events are not viewer ownership or app-attributable execution. Quotes are not guaranteed fills; hashes are not owner authentication. No wallet, signature, trade, paid-provider fallback, new token or public deployment is introduced. CRE remains omitted by user choice; Nansen is access-required with no fake portfolio substitute. Current Perpl detailed rules, primary-track fit, durable deployment/security review, participant agreements and direct approval resolving the prior publication hold are still required. No portal entry, PR, public push or upload was made.
