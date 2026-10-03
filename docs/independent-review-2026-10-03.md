# Independent release review — October 3, 2026

Reviewed existing checkout `/Users/himanshujha/Documents/Codex/2026-10-01/task-2/monad-project`, baseline `aca709e5cbe5d63d268c8b6b9b61ca16f892aa56`, committed checkpoint `3109c43fdf11873e1232ab0ffc69778ef859f041`, concurrent uncommitted Envio dependency overrides, and the parent's subsequent receipt/freshness fixes. This is an independent agent code review, not an external security audit or certification. No project files were edited, no build run, and no push, upload, account, credential, payment, signing or blockchain transaction was performed by this reviewer.

## Assessment

The code and existing evidence support a **local read-only demo** with honest rehearsal and integration limitations. **The three findings below were fixed by the parent and independently rechecked; no critical or important finding remains open in this bounded review.** Public release still requires the operational and authorization gates below. Current implementation does not establish hackathon or sponsor completion: CRE CLI simulation is absent; optional live Nansen evidence is absent; a public repository and deployed live product are absent; an application-owned onchain mechanism is absent.

Source review covered `src/core`, HTTP routes, Perpl/Envio/Nansen adapters, CRE workflow and claim preparation, Envio supervisor/listener/export, and UI recovery/freshness/export behavior. The approved focused spec and `docs/local-completion-2026-10-03.md` were read. The original root suite was rerun: **60/60 passed**. Initial sandbox run passed 56 tests; four temporary HTTP listener tests were denied `listen EPERM`; permitted execution outside the sandbox passed all 60. This was an environment restriction, not a code regression. Three additional adversarial probes reproduced failures that the original suite missed. After fixes, **62/62 passed**, root typecheck passed, and independent reruns returned incomplete receipt `valid: false`, future context first/cached `stale: true / true`, and malformed Nansen timestamp `UNKNOWN`.

## Findings

### Important — incomplete replay receipts can be declared valid — RESOLVED

Location: `src/core/receipt.ts:29`, `src/core/receipt.ts:57`, `src/core/receipt.ts:85`.

Before the fix, `verifyReceipt` checked only a small subset of the declared receipt shape. A caller could remove receipt identity/time/scenario/limitations, all policy binding fields except the two quantity strings, execution identity/operation/remaining position/timeline/submission count, and check expected/observed/source values. Retaining mandatory check names/results, status and quantity/writes fields and recomputing the ordinary SHA256 digests returned `valid: true` with all three verification checks PASS. The required policy network, chain, account, worker, market, direction, expiry and snapshot did not exist at all. `remainingPositionQuantity` was neither required nor reconciled; a complete receipt with an inconsistent remaining position similarly passed after resealing.

Practical effect: the public JSON inspector accepts unsupported incomplete records as “Receipt integrity verified,” despite the implementation promising supported complete replay receipts and quantity reconciliation. This is a structural-validation defect, not a signature forgery: anyone can compute an unkeyed digest by design, and the existing integrity-only disclaimer correctly limits authenticity. Do not solve this by claiming owner authentication or by rejecting legitimate rejected/partial/unknown receipts merely because their recorded predicates contain FAIL/UNKNOWN.

Reproduction executed against the initial reviewed source, before the fix:

```js
const { integrity, ...body } = runRehearsal(validInput, Date.now());
delete body.id; delete body.createdAt; delete body.scenario; delete body.limitations;
body.authorization = { authorizedCloseQuantity: '1', positionQuantity: '2' };
body.authorizationDigest = digest(body.authorization);
body.execution = { status: 'COMPLETED', providerWrites: 0,
  filledQuantity: '1', reservedQuantity: '0' };
body.checks = body.checks.map(c => ({ name: c.name, result: 'PASS' }));
verifyReceipt({ ...body, integrity: { algorithm: 'SHA-256', digest: digest(body) } });
// Observed: valid: true. Expected: unsupported/incomplete receipt.
```

Resolution independently inspected: runtime validation now requires receipt metadata, policy bindings/enums/dates/precision/price, execution identity/operation/submission limit/timeline, limitation strings and complete predicate provenance; quantity checks require positive approval/original quantities and remaining plus filled equals original. Regression cases cover resealed missing bindings and inconsistent conservation while retaining valid rejected/partial/unknown receipts. Original stripped-record probe now returns false. Additional status/operation cross-validation can be considered separately if the verifier is later promoted beyond integrity and supported-shape validation.

### Minor — cached Perpl contexts erase future-dated stale status — RESOLVED

Location: `src/data/perpl.ts:231`.

`normalizeContext` marks provider timestamps more than 15 seconds in the future stale. The 15-second cache path recomputes `stale` using only old timestamps and overwrites that decision. A mocked context timestamped `Date.now() + 60000` yielded `stale: true` on the first `getMarkets('mainnet')`, then `stale: false` on the immediate cached call.

Practical effect before the fix: API consumers got conflicting freshness metadata for the same snapshot. Current UI repeats future-date checks (`web/src/App.tsx:140`), and POST rehearsal uses the original snapshot's stale flag (`src/server.ts:165`), so this was not a provider-write or replay-dispatch bypass. Resolution: the cached path now includes the same future-date tolerance; independent mocked +60-second probe returns true on both calls.

### Minor / optional feature — invalid Nansen receipt time can pass budget freshness — RESOLVED

Location: `src/data/nansen.ts:167`.

`evaluateWalletBudget` compares `Date.parse(snapshot.receivedAt)` without checking finiteness. A normalized fixture snapshot changed to `receivedAt: 'invalid'`, then resealed with `digest(body)`, produced `WITHIN_LIMITS` for valid limits; both date comparisons are false for NaN.

Practical effect before the fix: a malformed independently supplied snapshot could support a supposedly fresh budget evaluation. Normalization generates valid dates and the server exposes only Nansen's access-required status, so this had no current live UI or financial effect. Resolution: evaluator now requires a finite parsed timestamp; independent resealed-invalid-time probe and new regression return UNKNOWN. If independently supplied snapshots become an exposed input, full supported snapshot/completeness/chain/source validation should accompany that expansion. Fixture source mode remains explicit.

## Positive evidence and safety boundaries

- Rehearsal uses integer quantities, binds the full generated policy digest, blocks altered account/worker/chain/market/operation, and stores original request hashes and receipts in a SQLite transaction. Same-key recovery is checked before fresh-snapshot requirements, so a persisted unknown result survives aging/restart; changed bodies conflict. Separate hypothetical rehearsals do not model a shared real-wallet allowance and must not later be promoted into a trading executor without additional state.
- HTTP server binds `127.0.0.1`. Mutating local routes reject foreign origins and bound JSON bodies. Perpl requests use fixed network origins, narrow GET path allowlists, redirect rejection and timeout; no arbitrary URL forwarding exists. Response-size checks occur after loading the body, so this is a local demo boundary rather than production resource-hardening assurance.
- Envio normalizes real event provenance, validates the projection against decoded parameters, detects conflicting duplicate identities, and rejects stale/inconsistent snapshots. Supervisor exports entities and committed chain metadata from the same read-only repeatable-read SQL transaction and atomically renames JSON. Recent indexing preserves a separate database/schema and recorded start window. The child listener preload scopes TCP listening to loopback; saved `envio-listener.txt` records `127.0.0.1:9899`. This saved observation does not certify every future runtime.
- CRE uses public HTTP and transaction-receipt reads only. Policy preimage/chain/exchange/transaction/account/market/quantity/freshness checks are present; duplicate decreases count once and conflicting records fail. The result expressly leaves owner authorization and finality unproven. The generated claim is hypothetical over an arbitrary participant's public testnet event, not the user's position or an app trade. Actual WASM build evidence is meaningful; local predicate success is not CRE CLI execution.
- The CRE HTTP trigger has empty authorization specifically for simulation. Its README explicitly prohibits deployment as-is. Production trigger authentication is a deployment gate, not an undisclosed current local-demo defect.
- UI labels hypothetical limits and replay results, locks unresolved requests and retains recovery identity across reloads, exposes partial/unknown outcomes, rechecks observation age, and exports the original receipt despite inspector edits. “Start a separate rehearsal” explicitly stops tracking the prior record only in the view and states no real transaction exists.
- No signing/sendTransaction/writeContract/broadcast path was found in the reviewed server, core, UI or CRE workflow. Public RPC JSON-RPC POSTs are reads (`eth_getTransactionReceipt`, `eth_blockNumber`, `eth_getBlockByNumber`), not blockchain writes. Local SQLite/Postgres/file writes are necessary local persistence, so “zero provider writes” should continue to mean no financial/provider mutation.
- Concurrent Envio overrides were inspected: `envio -> express 4.22.3`, `envio -> viem 2.57.2`, `esbuild 0.28.1`. Saved fresh `envio-audit-after.json` reports zero vulnerabilities; parent reports codegen/typecheck/13 integration tests passing. Those results resolve the checkpoint's old 11-entry advisory count, subject to the post-update live restart check. An audit returning zero is not a security guarantee.

## Release and submission gates

1. The identified receipt shape/conservation and two freshness defects are now resolved and independently verified. Keep these fixes and regression cases in the release checkpoint; this report does not certify unrelated future changes.
2. Reconfirm Envio's fresh network watermarks, local listeners and receipt cross-check after dependency changes. Preserve original timestamps and unavailable behavior during indexing backoff. Public release still needs an operational plan for the indexer, app persistence and hosting; loopback-only local services do not constitute a deployed product.
3. Use the verified event's official rules. Parent supplied current portal requirements: public GitHub repository accessible to `metropolis@hackathon.monad.xyz`, deployed live product on Monad mainnet **or testnet**, technical live-product demo <=3 minutes with no slides/codewalkthrough, and pitch <=2 minutes. This reviewer did not independently browse that portal; parent owns source attribution. Historical timing/track notes are not authoritative.
4. A pure public-read/replay product does not yet demonstrate its own deployed onchain mechanism or settlement. A hosted frontend that reads someone else's contracts is insufficient evidence of that criterion. A small registry might strengthen product utility, but eligibility remains conditional on the official wording; a decorative hash store must not be represented as financial settlement.
5. CRE sponsor completion requires successful actual CLI simulation or live deployment, blockchain plus external API use, and its required <=2-minute proof. Current local WASM and predicate evidence do not meet that gate. User-controlled installation/login is still needed. Empty-trigger deployment is not authorized.
6. Envio sponsor completion needs a running pipeline, public configuration/schema/handlers/client, and real-data end-to-end demo. Existing genuine pipeline evidence supports local integration; private source and saved snapshots alone do not complete the sponsor submission.
7. Omit Nansen sponsor completion until meaningful live authorized data use exists. The optional fixture adapter is correctly gated today.
8. No publication, external disclosure, transaction, new account, credential, payment or signing is authorized by this review. Preserve the existing publication block and obtain the required concrete final approval through the parent workflow.

## Minimal useful testnet component proposal — design only

If the user later authorizes an onchain extension, a narrowly scoped **ExitEvidenceRegistry** can let a user personally anchor a complete policy/observation receipt commitment for later comparison by another party. Store `msg.sender`, policy digest, canonical observation digest, referenced chain/transaction, nonce and block time; key records by owner plus nonce, reject duplicate nonce and zero digests, and emit an append-only `EvidenceAnchored` event. No asset custody, trade call, delegated spending, administrator rewrite or truth-verification claim is needed. The UI can compare exported JSON with a concrete anchored record and expose mismatches; Envio can index those events alongside public outcome observations. That makes the onchain record a useful shared integrity checkpoint rather than an unexplained hash.

The registry would prove only that a particular address committed to bytes at a recorded block. It would not prove ownership of a Perpl account, execution, correct outcomes, or settlement. Add authenticated owner policy registration/revocation only if it serves the actual product and is approved; a post-hoc commitment cannot be called prior trade authorization. Prepare and locally test source before any later request for deployment/signing approval. A user-approved testnet deployment, genuine transaction receipt and UI/indexer round trip would be required to demonstrate this component. Whether it qualifies for OnchainFinance must be confirmed against the actual mechanism/settlement requirements; this proposal is not an eligibility guarantee and no transaction is requested here.
