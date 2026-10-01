# Security and truthfulness boundaries

## Enforced in this build
- Loopback-only default server; explicit same-origin mutation checks; no permissive CORS
- Bounded JSON payloads and strict rehearsal fields
- Allowlisted public Perpl hosts and paths; user input cannot supply an upstream URL
- Exact decimal parsing and bounded integer arithmetic; network/market/precision/snapshot binding
- SQL transactions and idempotency-body conflicts; identical retries return the original receipt even after a restart or snapshot expiry
- Rehearsals cannot access a signing or provider-write adapter because neither exists
- Envio read-model provenance, watermark, age, duplicate consistency and exact decoded-value checks
- No Nansen payment fallback, Smart Money data or live request without an explicitly supplied authorized transport
- CRE only has read capabilities; no private keys or broadcast invocation

## Remaining limitations
This is a local development prototype, not an audited or production-hardened service. It has no multi-user authentication, hosted rate-limiting, retention/backup policy, production trigger authentication or deployment hardening. Do not expose it publicly without that review. Public data providers and the local host are trusted for their observations; a hash does not make their claims true. Nansen USD valuations are estimates, and wallet snapshots exclude derivative positions and debt. The Envio index begins at documented recent start blocks, not genesis. Browser rendering/visual fidelity is unverified in this execution environment.

## Independent-review fixes
The review found lost-response recovery could be discarded by an ordinary refresh; that path now retains the original key and requires an explicit separate-rehearsal action before abandoning recovery. Delayed verification results cannot certify subsequently edited JSON. Source freshness ages in the UI. CRE requires and hashes the full supported policy preimage; Nansen requires a complete first-and-last page. Collateral display precision follows the actual instance/token mapping. Missing mandatory receipt predicates fail structural verification even if a digest is recomputed.
