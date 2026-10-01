# Exit-evidence workbench: approved focused design

## Purpose
A trader-facing Monad Track 01 product that shows live Perpl liquidity, lets someone define exact limits for reducing an existing position, and compares observed outcomes with those limits. Partial outcomes and uncertainty are first-class. Mandate is an internal codename, not a cleared public brand.

## Approved scope
The user approved the focused CRE + Envio version on 2026-10-01. Build a useful read-only core now. Real provider data is distinct from simulated approvals/executions. The initial product does not submit trades, create wallet keys, sign messages, spend funds, create external accounts, or publish repositories/deployments.

## Architecture
Node 24 TypeScript server with explicit public endpoint allowlists; a pure integer policy, reconciliation and receipt package; durable SQLite rehearsal ledger; React/Vite interface. Public Perpl context/order books are live. Envio HyperIndex indexes real Monad exchange events and supplies the history feature through a narrow read-model adapter. A CRE workflow cross-checks a declared outcome against chain and HTTP evidence, with actual CLI simulation gated on user login.

## User journey
1. Choose mainnet or testnet and market. See current liquidity and freshness, with clearly labeled source.
2. Enter a hypothetical existing position and exact close quantity. Review immutable integer-resolved limits; no wallet signature is implied.
3. Run a labeled rehearsal: permitted close, unauthorized open request, partial fill, interrupted delivery, duplicate request, or tampered receipt.
4. Inspect approved versus observed quantities and checks. Export canonical JSON; tampering changes verification. Unknown outcomes retain their reservation and cannot silently resubmit.
5. Inspect live indexed activity, with Envio pipeline health and observed chain watermark. Missing Envio data is an unavailable state, never a fabricated activity stream.

## Safety and correctness
- Decimal inputs become integer strings; no floating-point decision arithmetic.
- Bind policy to schema, account, worker, network, chain, market, direction, quantity, price, expiry and snapshot.
- No opening/increasing, alternate markets/accounts, expired/revoked authorization, or amount above allowance.
- Filled plus reserved must never exceed authorized close quantity.
- Repeated idempotency key with identical body returns one execution; changed body returns conflict.
- Unknown requests remain reserved; duplicate fills count once; unrelated fills are rejected.
- Receipts bind policy digest, execution, observations, source modes and all check results. Integrity alone does not prove real-world truth.
- Rehearsal never reaches a network signing/writing adapter. No provider secrets or authentication endpoints exist.
- Read endpoints allowlist host and method, enforce timeout and bounds, validate network/precision, and identify stale/error data.
- Public values and hypothetical positions must never be labeled as the user's holdings.

## Interface
Use the previous master PRD's calm control-room direction: warm #F6F4EF canvas, #121A1F navigation, dark readable text, restrained green/amber/red with text labels. Primary hierarchy is liquidity, permission, outcome, evidence. Responsive keyboard-operable interface with loading/empty/error/stale/unknown states. No fake statistics or sponsor-complete badges.

## Required evidence
Deterministic tests for policy binding, decimal validation, idempotency, persistence/restart, uncertainty, fill dedupe and receipt tampering. Adapter parsing and failure tests; UI tests and browser screenshots. Real public read smoke. Genuine Envio pipeline evidence before describing Envio as integrated. Genuine CRE CLI simulation before describing CRE as demonstrated.

## Release gates
Local core is not hackathon-ready. Later: CRE user login; public repo approval; real testnet deployment with signing performed by the user; independent review; live product; <=3 minute technical demo and <=2 minute pitch. Core Envio/CRE bounties remain conditional. No Perpl trading-bounty claim, no optional sponsor work at expense of core.

## Approved optional Nansen addition
An independently gated current-balance adapter can evaluate user-defined wallet concentration and liquid-buffer budgets. It binds address, Monad mainnet, complete pagination, valuation availability, freshness and provenance. It never imports restricted Smart Money data, treats fixtures as live, or authorizes a trade. Live access requires a separate user-controlled secure connection.
