# Local completion checkpoint — October 3, 2026

Status: locally validated read-only workbench. Publication and submission are blocked. No push, upload, public deployment, PR, wallet operation, paid service, new account or authentication credential was performed.

## Workspace and preservation

Continued the existing `monad-project` checkout from `validated-source-upload` at aca709e5cbe5d63d268c8b6b9b61ca16f892aa56. Preserved `mac-validated-checkpoint` at 831c8d6470d1a7e709918203059274d7d2cb2a24. No applicable AGENTS.md was found in this checkout/ancestor paths. Four pre-existing untracked `web/design` screenshots were preserved; fresh screenshots are in the dated evidence directory. No duplicate build or unrelated project was created. The historical source ZIP was inspected and left unchanged; it contains server/frontend source and no node_modules/runtime/environment paths.

## Changes

- Added resumable Envio recent-window mode, retaining the October 1 backfill and separate recent database/schema. Recorded start blocks: mainnet 110192097; testnet 67841132.
- Restricted Envio child TCP listeners to loopback because this version ignores the host setting. Actual `lsof` proof records `127.0.0.1:9899`.
- Added a separate evidence-output directory option to the independent receipt cross-check.
- Updated UI test tooling and CRE viem to resolve their reported advisories; application bundle/design remains unchanged.
- Fixed the real WASM build by keeping the parameterized HTTP handler internal. Added `build:wasm` and a real public-testnet `prepare:claim` command with provenance and hypothetical-policy labeling.
- Corrected stale browser-blocked claims. Prepared a technical-demo/pitch script and honest submission draft.

## Verified evidence

Artifacts are under `docs/evidence/2026-10-03/`:

- Backend: 60/60 tests; root typecheck passes.
- UI: 26/26 tests on patched Vitest; production build and formatting pass.
- Integrations: Envio codegen/typecheck and real CRE SDK typecheck pass.
- Real desktop/mobile browser workflow: six scenarios, receipt/tamper checks, unchanged export, reload identity, network reset, zero browser errors, no mobile horizontal overflow and zero provider writes. Screenshots were visually inspected; bounded smoke, not exhaustive accessibility QA.
- Genuine Envio SQL ingestion reached fresh watermarks on both networks. Saved live-adapter proof records mainnet 110194016 and testnet 67843027, 50 public events each. Independent public receipt decoding matched indexed chain/contract/block/log/decoded values on both networks.
- CRE SDK/Javy generated actual WASM; byte count/SHA256 and the green build log are retained. Initial failing build remains evidence. A generated real public testnet claim passed local predicates with `creSimulationPerformed: false` and `ownerAuthorizationVerified: false`.
- Fresh audits: root/UI/CRE 0 after fixes; Envio 11 unresolved. See [dependency review](dependency-review-2026-10-03.md).

Live evidence is a timestamped observation, not a guarantee that a stopped service stays fresh. Startup debugging exposed nested schema/ABI versus handler path rules and an incompatible failed-attempt schema; the final supervisor preserves both prior schemas and uses the corrected recent schema. Public RPC timeouts temporarily made the app unavailable until indexing caught up. No timestamp was rewritten to disguise backfill.

## Review and remaining gates

Reviewed final changes for source/public-activity separation, quantity/digest binding, listener scope, database preservation, absence of signing paths and truthful integration claims. The historical independent review is documented in `evidence.md`; no new independent external/agent review or security audit is claimed. Independent release review still precedes any publication recommendation.

1. Supply the exact official event URL. Searches did not establish this project's event, current deadline, video limits or sponsor eligibility. Historical Track 01 and timing targets are not current verified requirements.
2. For CRE: install the official Mac CLI, then personally perform `cre login`. Run `npm run prepare:claim` and the README's read-only simulation command; preserve genuine output. No key or login is needed for the already-passed local WASM build.
3. Nansen is optional. Only pursue it with a secure authorized balance transport and a selected public wallet; fixture/predicate tests are not live evidence. No Nansen connector is callable here.
4. Resolve/review Envio dependency advisories before hosting. Fresh indexing may require waiting through public RPC backoff.
5. Review [submission draft](submission-draft.md) and [demo script](demo-script.md). These are scripts/materials, not completed hosted links or recorded videos.
6. Direct user approval remains required for the previously blocked GitHub push/upload and any publication/submission. This task never retried or bypassed that block. Testnet financial actions remain outside this task.

## Local run

`npm start` serves http://127.0.0.1:4100 after the built UI. In a second terminal, `npm --prefix integrations/envio run start:recent` resumes the current public-data window. If stopped, first remove only its stop marker with `rm -f integrations/envio/.runtime/recent/stop`. Stop it gracefully with `touch integrations/envio/.runtime/recent/stop`. Do not run standard/recent supervisors simultaneously. The app reports unavailable when snapshots age out.

The prior task's push denials remain in effect. Automatic review timeouts occurred for three initial local verification commands; the permitted single retry succeeded. Those timeouts were not a safety finding and did not authorize any external disclosure.

## Handoff state

The workbench was started at loopback port 4100 and its actual HTTP page/health were checked (`handoff-health.json`). The recent indexer was gracefully stopped and restarted: same start blocks and persisted ready/checkpoint metadata, with both watermarks advancing again (`envio-restart.txt`). Both foreground task-owned processes are running at handoff; their lifetime depends on this Mac execution session.
