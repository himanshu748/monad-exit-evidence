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
- Fixed independently reproduced incomplete receipt/conservation validation, cached future Perpl freshness and invalid Nansen timestamp handling. Added adversarial regression tests.
- Corrected stale browser-blocked claims. Prepared a technical-demo/pitch script and honest submission draft.

## Verified evidence

Artifacts are under `docs/evidence/2026-10-03/`:

- Backend: 63/63 tests after independent-review regression fixes; root typecheck passes.
- UI: 26/26 tests on patched Vitest; production build and formatting pass.
- Integrations: Envio codegen/typecheck and real CRE SDK typecheck pass.
- Real desktop/mobile browser workflow: six scenarios, receipt/tamper checks, unchanged export, reload identity, network reset, zero browser errors, no mobile horizontal overflow and zero provider writes. Screenshots were visually inspected; bounded smoke, not exhaustive accessibility QA.
- Genuine Envio SQL ingestion reached fresh watermarks on both networks. Saved live-adapter proof records mainnet 110194016 and testnet 67843027, 50 public events each. Independent public receipt decoding matched indexed chain/contract/block/log/decoded values on both networks.
- CRE SDK/Javy generated actual WASM; byte count/SHA256 and the green build log are retained. Initial failing build remains evidence. A generated real public testnet claim passed local predicates with `creSimulationPerformed: false` and `ownerAuthorizationVerified: false`.
- Fresh audits: root/UI/CRE/Envio 0 after fixes. See [dependency review](dependency-review-2026-10-03.md).

Live evidence is a timestamped observation, not a guarantee that a stopped service stays fresh. Startup debugging exposed nested schema/ABI versus handler path rules and an incompatible failed-attempt schema; the final supervisor preserves both prior schemas and uses the corrected recent schema. Public RPC timeouts temporarily made the app unavailable until indexing caught up. No timestamp was rewritten to disguise backfill.

## Review and remaining gates

Independent agent release review is complete. All three reproduced findings were fixed and independently rechecked; no open critical or important finding remains in that bounded review. This is not a security certification. Report: `independent-review-2026-10-03.md`.

1. Event confirmed as Monad Metropolis: https://hackathon.monad.xyz/. Deadline October 13 at 11:59 PM ET (October 14 03:59 UTC / 09:29 IST). Detailed portal rules require public GitHub source and a live deployed product on Monad mainnet OR testnet, technical live-product demo <=3 minutes and pitch <=2 minutes. Exactly one primary track. The read-only local workbench lacks its own deployed onchain mechanism; Onchain Finance eligibility is not established. See `submission-draft.md` and `onchain-component-proposal.md`.
2. User explicitly chose to proceed without CRE bounty on October 3. No CRE CLI simulation is claimed or required for the proposed minimal bounty set. SDK/WASM evidence remains development evidence.
3. Omit Nansen bounty: there is no live authorized transport. No Nansen credentials were requested.
4. Envio dependency advisories are resolved with compatible scoped updates and genuine post-update live receipt cross-checks. Public source/pipeline/demo deliverables remain conditional on release approval and hosting.
5. Local technical/pitch recordings and their transcripts are prepared in the separate handoff workspace; no hosted video link is claimed. Both use actual product capture, with local speech synthesis and no paid service. See the media manifest for durations and provenance.
6. Direct user approval remains required for the previously blocked GitHub push/upload and any publication/submission. This task never retried or bypassed that block. Wallet transactions remain outside this task.

## Local run

`npm start` serves http://127.0.0.1:4100 after the built UI. In a second terminal, `npm --prefix integrations/envio run start:recent` resumes the current public-data window. If stopped, first remove only its stop marker with `rm -f integrations/envio/.runtime/recent/stop`. Stop it gracefully with `touch integrations/envio/.runtime/recent/stop`. Do not run standard/recent supervisors simultaneously. The app reports unavailable when snapshots age out.

The prior task's push denials remain in effect. Automatic review timeouts occurred for three initial local verification commands; the permitted single retry succeeded. Those timeouts were not a safety finding and did not authorize any external disclosure.

## Handoff state

The workbench was started at loopback port 4100 and its actual HTTP page/health were checked (`handoff-health.json`). The recent indexer was gracefully stopped and restarted: same start blocks and persisted ready/checkpoint metadata, with both watermarks advancing again (`envio-restart.txt`). Both foreground task-owned processes are running at handoff; their lifetime depends on this Mac execution session.
