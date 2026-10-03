# Local technical demo — rehearsal script (target under 3 minutes)

This script accompanies the local recorded demo; inspect the media manifest before approved upload. Keep the read-only and hypothetical-position labels visible. Use fresh public data, or show the real unavailable state and explain the interruption. Do not replace missing data with fixtures.

Before recording: run `npm start`, open http://127.0.0.1:4100, and start the documented recent Envio supervisor in a second terminal if the RPC is healthy. Refresh reads. Confirm source timestamps; never show historical JSON as current data.

| Time | Action | Narration |
| --- | --- | --- |
| 0:00–0:20 | Show network and live BTC liquidity | “Exit Evidence helps review a position reduction and distinguish a request, a fill, and an unknown outcome. These are public Perpl reads; no holdings or wallet are connected.” |
| 0:20–0:45 | Enter a hypothetical existing position and a smaller close quantity; review limits | “Review freezes the network, market, snapshot and exact integer limits. Changing a field invalidates review. This is a hypothetical limit review, not an owner signature.” |
| 0:45–1:10 | Select Partial fill; review and run | “The observed rehearsal quantity is below the authorized amount. Partial is not completion; the panel explains how much filled and the remaining reservation.” |
| 1:10–1:35 | Select Interrupted response; review and run, then reload and retry the same request | “An unknown outcome keeps its reservation and original request identity. Retrying recovers the recorded receipt instead of creating a second attempt.” |
| 1:35–2:00 | Export JSON; change a quantity in the inspector and verify | “The exported receipt is unchanged. Editing it breaks integrity. Even a valid digest cannot prove owner authorization or a real trade.” |
| 2:00–2:25 | Show indexed activity, watermark and source status | “Envio ingests public Monad events into SQL. This is arbitrary public participant activity, separate from our simulated executions. Missing or stale indexer data is unavailable.” |
| 2:25–2:45 | Show integration gates and brief architecture | “Envio supplies real public exchange activity. CRE and Nansen bounty claims are omitted. This local build makes zero provider writes.” |
| 2:45–2:55 | End on the workbench | “The useful boundary is knowing what the evidence proves, including what remains unknown.” |

Use Start a separate rehearsal when abandoning an unknown result for a new demonstration. Keep the explicit action visible. Final sponsor/demo clips require actual validated live results; remove any completion claim for a gated integration.

## Pitch script (target under 2 minutes)

A trading request is not a fill, and a missing response is not success. Exit Evidence Workbench makes those distinctions visible before people trust automation around a position reduction.

The workbench combines public Perpl liquidity on Monad with exact hypothetical limits. It resolves decimals into integer units, freezes reviewed scope, and shows partial, rejected, duplicate and unknown rehearsal outcomes. The durable ledger preserves request identity across reload and restart. Receipts make changes detectable while stating the limits of hash verification.

Envio supplies selected real public exchange activity through committed SQL watermarks. Its events describe public participants, not the viewer's holdings. The read-only CRE workflow is designed to compare a bounded claim with independently fetched chain and HTTP evidence; simulation has not been performed and its bounty is omitted by user choice. Optional Nansen portfolio context requires a user-authorized transport and is not live in this build.

The current product is a local read-only prototype. Its next milestone is confirming the primary track mechanism requirement and approving a durable hosted demo. We are not presenting a trading bot or claiming a live financial execution.
