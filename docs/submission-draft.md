# Submission draft — publication preparation

Prepared descriptions and historical HyperIndex proof do not establish current source availability. The [October 5 publication validation](publication-validation-2026-10-05.md) records the published source/deployment, unavailable activity on both networks at its check, and Deepgram narration over historical HyperIndex visuals. HyperSync remains unactivated and unverified. Fresh live evidence and qualifying watch links remain required before submission.

Title: Exit Evidence Workbench

Short description: A real-data Monad workbench for Perpl quotes, Envio exchange activity and independently decoded public transaction evidence.

Problem: A request is not a fill, and an indexed summary needs its source checked. Integrators need actual quantities, transaction provenance and source uncertainty together.

Solution: Read current public Perpl market configuration and books, calculate quoted depth only for a quantity the user enters, select a real indexed event, independently fetch its public transaction receipt/canonical block, and compare the complete normalized event. Export an exact observation with its timestamps and limitations.

Implementation: Node 24/TypeScript, React/Vite, viem strict ABI decoding, real Envio HyperIndex/PostgreSQL ingestion, atomic committed-watermark read models, and allowlisted public Perpl/Monad reads. No signing key, wallet, trading dispatch, paid-provider fallback or live Nansen transport is configured. CRE is omitted by user choice.

Current runtime: real public data or explicit unavailable/error. No sample positions, prefilled transactions, rehearsal controls or generated execution outcomes. Legacy simulation routes return HTTP 410. Offline regression inputs and historical recordings are not presented as live integration evidence.

Boundaries: Public participant activity is not viewer ownership or execution by this app. Quantity can remain unknown when an event's ABI omits it. Book estimates are not executable prices or guaranteed fills. Canonical-block checks are point-in-time provider observations; export digests detect changes without authenticating an owner.

## Candidates and completion gates

| Item | Current local implementation | Remaining gate |
| --- | --- | --- |
| Best Use of Envio | Real handlers, complete normalized events, committed SQL/window provenance, historically captured activity and independent receipt comparison | Keep genuine pipeline fresh and sustained; approved accessible source/product/proof |
| Best use of Perpl's API | Real public configuration and quotes power the UI; no sample quantity needed to display a book | Not satisfied: requires a bot/automation with real execution, risk management and profitability |
| Best Analytics / Risk Tool | Actual quoted depth for user-entered amounts plus transaction/index provenance inspection | Not satisfied: requires protocol metrics and wallet positions/history/statistics/margin/watch views |
| CRE | OMIT — user choice | No successful CLI simulation claim |
| Nansen | Access-required | Authorized live access and meaningful core product integration; no fixture portfolio claim |
| Primary track | Historical target Onchain Finance; not certified eligible | Confirm current criteria; the app has no owned onchain settlement mechanism |
| Deployed product | Source checkpoint `15eedc6` deployed at https://monad-exit-evidence.vercel.app | Sustain fresh genuine activity (unavailable at the October 5 check); HyperSync activation requires authenticated proof |
| Source | Published checkpoint `15eedc6`; bounded review evidence in the [pre-deployment checkpoint](publication-checkpoint-2026-10-05.md) | Keep published source aligned with deployment; do not imply full-review coverage |
| Video and pitch | Deepgram-narrated historical HyperIndex visuals; technical 98.44s, pitch 66.153s | Listening/playback checks, final hosting metadata and qualifying watch links remain pending |
| Name, logo, descriptions | Name/description and SVG logo; portal requires raster logo <=3 MB | Accurate approved public fields; no name clearance claimed |
| GTM / acquisition | Proposed experiments in `go-to-market.md` | No existing users, partnerships or traction claimed |
| Team/contact/agreements | Not entered in portal | Accurate participant input and personal agreement acceptance |

The [bounty proof packet](bounty-evidence.md) contains draft sponsor descriptions and testing/recording instructions. Exactly one primary track and the ability to combine candidates must be confirmed before selection. No eligibility, prize entitlement or completed entry is asserted.

Rules and exact gaps: [authenticated October 4 catalog review](hackathon-rules-2026-10-04.md). Envio explicitly allows stacking; the current Perpl targets do not meet deliverables. The dashboard deadline is October 14 at 09:29 GMT+5:30 / October 13 at 23:59 Eastern.

App: https://monad-exit-evidence.vercel.app. Public source: https://github.com/himanshu748/monad-exit-evidence; checkpoint `15eedc6` was published and deployed on October 5. The prepared Deepgram technical/pitch MP4 durations fit the saved general limits, but final watch links must use YouTube, Loom or Vimeo and are not claimed yet. The saved October 4 rules state that registration closes October 6; confirm participant registration. This task has not created or submitted a portal entry. Do not select a primary track or attest personal agreements without accurate participant input.
