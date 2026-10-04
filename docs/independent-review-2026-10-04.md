# Independent bounded review — real integrations, October 4, 2026

A separate existing release reviewer inspected the change from simulated runtime flows to real public Perpl/Monad transaction reads and complete Envio comparisons. No publication or file mutation was performed by the reviewer.

Findings and fixes:

- Important: the first transaction comparator omitted block hash, observed timestamp and decoded ABI parameters. The Envio adapter now returns its entire validated normalized IndexedEvent; comparison checks every normalized field. A regression uses actual historical proof provenance and rejects altered block hash/time/decoded fields/contract/chain.
- Minor: quote-depth freshness omitted the current market configuration's stale flag. Both book and depth results now include context freshness.
- Minor: absence from the 50-event export was labeled NOT_IN_CURRENT_WINDOW. It is now NOT_IN_CURRENT_PAGE, which does not claim the event lies outside the indexed block range.

The reviewer independently rechecked all three fixes, 16/16 targeted comparison/Envio/runtime-selection tests, root/web typechecks and whitespace checks. No critical or important finding remained within that bounded review. Request-generation guards handle stale asynchronous responses; legacy simulation routes are blocked; validated named windows preserve separate persistent databases. The reviewer did not repeat the live RPC/browser runs, which are recorded separately in the current validation report. This review does not certify production hosting security or sponsor eligibility.
