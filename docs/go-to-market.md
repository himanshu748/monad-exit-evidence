# Initial go-to-market proposal

Target users: Monad trading-tool developers and protocol integration teams checking public market data and exchange-event adapters. The current real-data product helps compare exact indexed values with transaction receipts and inspect quoted depth. It does not offer custody, trading advice, real execution or connected-account portfolio analytics.

First two weeks after approved release: publish one reproducible real-provider example with actual source times, index-window bounds and known limitations. Invite 5–8 integration developers to permitted individual walkthroughs. Ask them to inspect a real indexed event, compare its complete receipt data, explain missing fields and export the observation. These interviews have not occurred; consented feedback must not contain wallet credentials.

Weeks three and four: improve the highest-friction transaction/source-inspection step, run two small integration workshops and document one independently reproducible public receipt check. Outreach/tutorial submission to Monad/Envio/Perpl communities requires explicit messaging approval. Partnerships and distribution remain proposals.

Measure: walkthrough completion, time to distinguish a request event from a fill, accurate interpretation of source/page/freshness gaps, successful unchanged export and repeat usage on a second real integration issue. Initial validation goals: at least 4 of 6 interviewed builders complete the source checks unaided and at least 2 return with a real adapter/provenance issue. These are goals, not current metrics.

Release sequence: confirm track and sponsor fit; approve source/publication; review and establish durable real-provider hosting; publish the inspected current demo and pitch; invite a small cohort. If the need is weak, narrow scope rather than invent demand. A financial execution product requires separate research, explicit transaction authorization, implementation and review.
