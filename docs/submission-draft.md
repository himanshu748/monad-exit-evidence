# Submission draft — local only

Title: Exit Evidence Workbench

Short description: A read-only Monad workbench that combines public liquidity, exact hypothetical position-reduction limits, durable rehearsal outcomes and inspectable evidence.

Problem: A successful order request does not establish a fill. Partial outcomes, retries and lost responses can obscure what a system actually observed. Users need quantities, scope and uncertainty shown together.

Implementation: Node 24/TypeScript, SQLite idempotency and reservations, React/Vite, viem, public Perpl market/depth reads, Envio HyperIndex events and committed SQL snapshots, a real Chainlink CRE SDK read-only workflow, and an optional typed Nansen adapter with no live transport configured.

What is demonstrated: exact integer policy/reconciliation, six labeled rehearsal cases, receipt tampering detection, unchanged exports, reload identity, network review reset, real public Perpl reads, and genuine Envio ingestion. Current freshness must be verified at demo time.

What is not claimed: wallet signatures, ownership, trade dispatch/fills attributable to this app, owner-authenticated receipts, successful CRE CLI simulation, live Nansen data, hosted deployment, sponsor eligibility or prize entitlement.

## Requirement matrix

| Item | Current state | Minimum next step |
| --- | --- | --- |
| Official event and deadline | Unresolved: no event URL in checkpoint; public searches did not establish the specific event | Provide the official event URL; check rules and submission timezone directly |
| Track 01 / Onchain Finance & Trading | Historical project target, current eligibility unverified | Confirm against the event's official rules |
| Envio target | Real SDK/indexer and public event ingestion; local fresh-watermark evidence depends on RPC | Run recent mode, retain live adapter and independent receipt cross-check at demo time |
| CRE target | Real SDK, typecheck; authenticated simulation pending | User installs official CLI and performs `cre login`, then runs the documented read-only HTTP-trigger simulation with a real observation claim |
| Nansen optional target | Parser/budget tests only; access-required | Only if pursuing it: provide a secure authorized current-balance transport and a selected public wallet address, without sending credentials in chat |
| Public repository/source archive | Existing source complete locally; prior upload blocked, old ZIP predates current work | Obtain direct user publication/upload approval and independent release review; this task does not retry the blocked action |
| Demo URL / video / pitch URL | Local app and scripts; no hosted links or recording claimed | Record under the verified event limits and obtain approval for any external upload |
| Testnet deployment | Unknown event requirement; no signing or transactions permitted in this task | Confirm necessity with organizers and let the user perform any wallet/transaction steps |
| Team/contact/license fields | Not verified or filled | User supplies participant details and accepts any required agreements personally |

Reference links checked October 3: [CRE CLI installation](https://docs.chain.link/cre/getting-started/cli-installation/macos-linux), [CRE simulation](https://docs.chain.link/cre/guides/operations/simulating-workflows), [Envio environment variables](https://docs.envio.dev/docs/HyperIndex/environment-variables). These are integration documentation, not event rules. Do not submit this draft or claim sponsor completion until the remaining gates are verified.
