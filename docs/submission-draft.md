# Submission summary — verified October 9, 2026

The existing entry was verified **Ready for judging**, **5 / 5 complete**, on October 9 at approximately 15:31 IST. The [submission receipt](submission-receipt-2026-10-09.md) records the saved fields and published video links. This summary was updated October 11 from that record; it does not claim a new portal check. The filename is retained for existing links. Descriptions below summarize the product rather than reproduce every saved portal field verbatim.

Title: Exit Evidence Workbench

Short description: A real-data Monad workbench for Perpl quotes, Envio exchange activity and independently decoded public transaction evidence.

Problem: A request is not a fill, and an indexed summary needs its source checked. Integrators need actual quantities, transaction provenance and source uncertainty together.

Solution: Read current public Perpl market configuration and books, calculate quoted depth only for a quantity the user enters, select a real indexed event, independently fetch its public transaction receipt/canonical block, and compare the complete normalized event. Export an exact observation with its timestamps and limitations.

Implementation: Node 24/TypeScript, React/Vite, viem strict ABI decoding, deployed on-demand Envio HyperSync with complete bounded block coverage, and allowlisted public Perpl/Monad reads. The optional historical HyperIndex/PostgreSQL path is retained. No signing key, wallet, trading dispatch, paid-provider fallback or live Nansen transport is configured. CRE is omitted by user choice.

Current runtime: real public data or explicit unavailable/error. No sample positions, prefilled transactions, rehearsal controls or generated execution outcomes. Legacy simulation routes return HTTP 410. Offline regression inputs and historical recordings are not presented as live integration evidence.

Boundaries: Public participant activity is not viewer ownership or execution by this app. Quantity can remain unknown when an event's ABI omits it. Book estimates are not executable prices or guaranteed fills. Canonical-block checks are point-in-time provider observations; export digests detect changes without authenticating an owner.

## Submitted scope and evidence

| Item | Recorded status | Limits |
| --- | --- | --- |
| Best Use of Envio | Selected; Envio explanation and technical demo saved | Organizer fit remains unconfirmed; provider quotas still apply |
| Best use of Perpl's API | Not selected | Requires real execution, risk management and profitability absent from this product |
| Best Analytics / Risk Tool | Not selected | Required protocol and wallet portfolio dashboards are absent |
| CRE | Omitted by user choice | No successful CLI simulation claim |
| Nansen | Not claimed | No authorized live integration |
| Primary track | Trust, Identity & AI Infrastructure selected | Selection is not organizer eligibility approval |
| Deployed product and source | Application checkpoint `242c9bd` deployed at [production](https://monad-exit-evidence.vercel.app/) | [October 9 cache validation](lookup-cache-validation-2026-10-09.md) is bounded evidence, not sustained-load proof |
| Video and pitch | [Technical](https://youtu.be/Z6wp9TRV9Dw), 1:48; [pitch](https://youtu.be/wiKvrTWdOUE), approximately 1:08; both unlisted and saved in the entry | Show October 7 hosted build with disclosed synthetic Deepgram narration and trims; do not show the later cache fix |
| Name, logo, descriptions | Saved in the existing entry | No name clearance claimed |
| GTM / acquisition | Proposal saved | Interviews, users, partnerships and traction are not claimed |
| Profile/team and submission | Dashboard 5 / 5 complete; Ready for judging persisted after reload | No separate final-submit button or agreement prompt appeared; do not infer additional legal acceptance |

The [bounty proof packet](bounty-evidence.md) explains implemented integrations and excluded targets. The [saved rules](hackathon-rules-2026-10-04.md) preserve the reviewed criteria. The October 9 portal displayed a deadline of October 14, 2026 at 09:29 IST / October 13 at 23:59 ET; recheck it before relying on a later edit window.

[Existing submission](https://hackathon.monad.xyz/project?tab=submission) · [App](https://monad-exit-evidence.vercel.app/) · [Public source](https://github.com/himanshu748/monad-exit-evidence). Continue the existing entry if changes are needed; no duplicate was created.
