# Exit Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a real public-data exit evidence workbench with a tested rehearsal engine and honest integration gates.
**Architecture:** Separate pure policy/receipt arithmetic from the durable rehearsal server, external read adapters and React interface. Envio and CRE modules consume narrowly versioned evidence contracts; neither can authorize or dispatch a financial operation.
**Tech Stack:** Node 24, TypeScript, node:test, node:sqlite, React, Vite, viem, Envio HyperIndex v3, Chainlink CRE SDK.
**Spec:** ../specs/2026-10-01-exit-evidence.md

## Global Constraints
- No money, wallet transactions, private keys, external account creation or public publishing.
- Mandate remains an internal codename.
- Live Perpl and chain observations are separate from replay approvals/executions.
- Integer strings represent all authority-bearing quantities.
- Missing provider/runtime/login produces a visible gate, not a successful integration claim.

## Review Focus
- Repeated clicks or retries after a lost response preserve one execution.
- Network/market changes cannot mix configurations or silently modify reviewed quantities.
- Timestamp gaps, malformed decimals and unsafe provider numbers fail explicitly.
- Partial/unknown status cannot become success through receipt rendering.
- Direct calls, unexpected JSON fields and client-controlled upstream URLs cannot reach privileged actions.

### Task 1: Pure policy, receipts and durable rehearsal
**Files:** src/core/{types,quantity,policy,receipt,rehearsal}.ts; tests/core.test.ts; tests/ledger.test.ts
**Interfaces:** runRehearsal(input: RehearsalInput, now: number): Receipt; verifyReceipt(receipt: unknown): VerificationResult; RehearsalLedger.run(key:string,input:RehearsalInput): Receipt.
- [ ] Write failing tests: 0.04 BTC minus permitted 0.02 resolves to 4000/2000 lots at 5 decimals; exponent/negative/precision overflow rejected; unauthorized open sends zero; wrong network/account rejected.
- [ ] Run node --test tests/core.test.ts and observe failure before implementation.
- [ ] Implement strict parsing, canonical field serialization and deterministic policy evaluation.
- [ ] Add RED then GREEN tests for exact replay, changed body conflict, durable restart, duplicate fills, interrupted reservation and receipt tampering.
- [ ] Run full node:test suite and commit core.

### Task 2: Live read adapters and HTTP server
**Files:** src/data/{perpl,rpc}.ts; src/server.ts; tests/data.test.ts; tests/http.test.ts
**Interfaces:** GET /api/health; GET /api/markets?network=mainnet|testnet; GET /api/liquidity?network=&marketId=&quantity=&direction=long|short; GET /api/activity?network=; POST /api/rehearsals; POST /api/receipts/verify.
- [ ] Write failing parser tests for bad chain, missing precision, unsafe integers, stale quotes and HTTP failures; server rejects unlisted route and oversized JSON.
- [ ] Run tests to RED; implement allowlisted fetches with timeout and visible source timestamps.
- [ ] Implement server around core and SQLite. Public reads never accept URLs from clients. Rehearsal POST requires idempotency header and returns same receipt for replay.
- [ ] Test interrupted/repeated HTTP requests, bad payload and direct unauthorized action input. Run full suite; commit.

### Task 3: Complete interface
**Files:** web/src/{App,MarketPanel,PermissionPanel,OutcomePanel,ActivityPanel}.tsx; web/src/styles.css; web/index.html; web/vite.config.ts
**Interfaces:** Consume Task 2 API. API responses remain the source of quantities, checks and evidence labels; no client-generated completion claims.
- [ ] Generate full-screen visual concept in the established design direction and extract tokens.
- [ ] Write UI tests for input validation, disabled pending action, replay labels, partial/unknown copy, network reset and accessible labels. Observe RED.
- [ ] Implement responsive React view with immutable review step, scenario controls, live-source panel and receipt export/verify.
- [ ] Run UI tests, build, browser interaction tests and desktop/mobile screenshot inspection; commit.

### Task 4: Genuine Envio read model
**Files:** integrations/envio/{config.yaml,schema.graphql,src/EventHandlers.ts,README.md}; src/data/envio.ts; tests/envio.test.ts
**Interfaces:** Normalized activity events include chainId, contract, transactionHash, blockNumber, logIndex, kind, source:'ENVIO', observedAt, outcome and exact decoded values. App consumes only actual indexer data.
- [ ] Test event dedupe, malformed event rejection and deterministic projection; observe RED.
- [ ] Implement HyperIndex config/handlers against official Perpl ABI, use public RPC for sync, and wire read model.
- [ ] Attempt real pipeline using available lawful runtime; never generate credentials or weaken security. Run to a verified chain watermark and retain queries/results, or report exact runtime blocker.
- [ ] Test adapter unavailable UI state and full suite; commit.

### Task 5: CRE workflow and integration evidence
**Files:** integrations/cre/{project.yaml,workflow/workflow.yaml,workflow/main.ts,README.md}; tests/verification.test.ts; docs/evidence.md
**Interfaces:** Input binds chainId, exchange, transactionHash and policy/receipt digest; output names each supported predicate and its source/method. Only read capabilities, no signing or broadcast.
- [ ] Write predicate tests for wrong chain/contract, missing data, changed digest and failed/unknown observations; observe RED.
- [ ] Implement real CRE SDK workflow combining EVM and HTTP reads; compile/test code.
- [ ] Run actual CLI simulation only if user has completed required login. Otherwise preserve exact command and pending gate, without calling unit tests a simulation.
- [ ] Record versions, command outcomes and source links; run full suite; commit.

### Task 6: Independent review and delivery
**Files:** README.md; docs/evidence.md; docs/security.md
- [ ] Run tests, typecheck, production build, live public reads and browser flows on final commit.
- [ ] Request independent review with spec/plan, exact code range and test evidence; fix important findings with regression tests.
- [ ] Package reproducible source and verified screenshots; report passed versus blocked stages. No ready/submission/deployed claim without the corresponding evidence.
