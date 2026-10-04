# Submission draft — local only

Title: Exit Evidence Workbench

Short description: A read-only Monad workbench that combines public liquidity, exact hypothetical position-reduction limits, durable rehearsal outcomes and inspectable evidence.

Problem: A successful order request does not establish a fill. Partial outcomes, retries and lost responses can obscure what a system actually observed. Users need quantities, scope and uncertainty shown together.

Implementation: Node 24/TypeScript, SQLite idempotency and reservations, React/Vite, viem, public Perpl market/depth reads, Envio HyperIndex events and committed SQL snapshots, a real Chainlink CRE SDK read-only workflow, and an optional typed Nansen adapter with no live transport configured.

What is demonstrated: exact integer policy/reconciliation, six labeled rehearsal cases, receipt tampering detection, unchanged exports, reload identity, network review reset, real public Perpl reads, and genuine Envio ingestion. Current freshness must be verified at demo time.

What is not claimed: wallet signatures, ownership, trade dispatch/fills attributable to this app, owner-authenticated receipts, successful CRE CLI simulation, live Nansen data, hosted deployment, sponsor eligibility or prize entitlement.

## Verified portal requirements and completion gates

Event: [Monad Metropolis portal](https://hackathon.monad.xyz/). Submission deadline: October 13, 2026 at 11:59 PM ET, equivalent to October 14 03:59 UTC / 09:29 IST. Detailed portal requirements below come from the authorized October 3 review. The official public page was rechecked October 4; the anonymous catalog returned authentication-required, so current detailed Perpl rules and any changes remain unverified. Generic FAQ wording must not override detailed track rules.

| Item | Local state | Remaining gate |
| --- | --- | --- |
| Primary track | Onchain Finance is the historical target, not certified eligible | Its mechanism/settlement criterion is not demonstrated by public reads and replay. Confirm fit with organizers or review a useful onchain extension before committing to the track |
| Deployed product | Local loopback product only | Mainnet OR testnet deployment qualifies under portal wording; hosting alone does not establish an app-owned onchain mechanism |
| Public GitHub | Complete reviewed source/archive local; origin is `himanshu748/monad-exit-evidence` | Direct approval for blocked push/upload, public visibility, organizer access `metropolis@hackathon.monad.xyz` |
| Envio bounty | Genuine self-hosted ingestion, configuration/schema/handlers/client, SQL exports, independent receipt cross-checks and actual product demo | Keep the pipeline caught up at demo time; publish required sources and accessible evidence after approval. Historical ingestion does not prove current freshness |
| Perpl API bounty | Real public market configuration and order books drive the workbench | Candidate pending signed-in rules, including whether read-only use qualifies, track/network limits and required proof |
| Perpl Analytics / Risk Tool bounty | Exact hypothetical close/depth estimates and partial/unknown outcome inspection | Candidate pending sponsor criteria; no real connected-account exposure or app-attributable trade analytics are demonstrated |
| CRE bounty | OMIT — user chose proceed without CRE | Do not claim SDK compilation/local predicates as successful CLI simulation |
| Nansen bounty | OMIT — no meaningful live data integration | Do not claim fixture tests as live integration |
| Technical video | Local actual-product recording <=3 minutes | Inspect final local media, then approve hosting/upload; no slides or code walkthrough in product recording |
| Pitch video | Local actual-product footage with pitch narration <=2 minutes | Approve hosting/upload |
| Name / description / logo | Exit Evidence Workbench; descriptions above; local SVG logo | Review approved public fields |
| GTM / acquisition | Prepared in `go-to-market.md` | Proposed plan, not existing users or traction |
| Team / contact / agreements | Not submitted | Participant supplies accurate details and personally accepts agreements |

Proposed candidate set: **Best Use of Envio**, **Best use of Perpl's API**, and **Best Analytics / Risk Tool**. Envio is the strongest demonstrated integration; both Perpl candidates require exact-rule confirmation before selection. Exactly one primary track and any restrictions on combining bounties remain unresolved. No prize entitlement is asserted. The [bounty proof packet](bounty-evidence.md) contains truthful draft sponsor descriptions, source references, current-data checks and the demo proof sequence.

Official detailed sources: [Onchain Finance](https://hackathon.monad.xyz/tracks/onchain-finance), [Envio](https://hackathon.monad.xyz/tracks/best-use-of-envio), [CRE](https://hackathon.monad.xyz/tracks/best-workflow-with-cre), [Nansen](https://hackathon.monad.xyz/tracks/best-use-of-nansen). Public web extraction failed for the client-rendered portal in this local task; the authorized portal session review supplied the requirements. No project or submission was created by this task.
