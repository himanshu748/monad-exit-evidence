# Historical lookup caching fix — October 9, 2026

The previous hosted reader exhausted its per-instance provider budget after several historical event selections. A fresh baseline on the production alias reproduced only 3 successful Envio comparisons out of 8 testnet event selections.

## Change

Application commit: `242c9bd659e982bcae77b2147916b5e81f638495`.

- Reuse a verified provider head from a completed preview or a shared head lookup for at most 30 seconds, bounded by source freshness.
- Cache only completely queried, strictly parsed historical blocks; select each requested transaction hash and log index from that block. Concurrent requests for the same block share the query.
- Preserve original query and provider timestamps. Repeated selections do not refresh cache age.
- Bound retention to 16 blocks and 4,000 events. Invalidate network caches after shared source failures; generation checks prevent older in-flight work from repopulating them.
- Keep the 15-provider-request/minute ceiling, four reserved preview requests, strict ABI/provenance checks and independent receipt comparison unchanged.

## Verification

- Backend: 132/132 tests passed.
- HyperSync regressions after the final test typing correction: 25/25 passed.
- Frontend: 36/36 tests passed.
- Typechecking and full production build passed.
- Offline regression: eight distinct historical blocks after a preview require ten provider requests total; repeated selections require no additional provider requests.
- Offline regressions cover shared blocks and concurrent head reads, network isolation, expiry, source freshness, cache eviction, upstream failure/cooldown and late completion after invalidation.

## Hosted result

Deployed the tracked source checkpoint to Vercel production and verified status Ready and the alias https://monad-exit-evidence.vercel.app.

Deployment: https://monad-exit-evidence-m30zn8kgf-himanshus-projects-acd54afd.vercel.app

| Probe | Result |
| --- | --- |
| Testnet, before fix | 3/8 INDEX_AND_CHAIN_MATCH; 5/8 UNAVAILABLE |
| Testnet, same eight events after fix | 8/8 INDEX_AND_CHAIN_MATCH |
| Mainnet, eight historical events after fix | 8/8 INDEX_AND_CHAIN_MATCH |

The testnet sample contained eight distinct logs in one transaction/block. The mainnet sample contained eight distinct transactions in one block. Each successful response matched all normalized fields of the previously captured genuine event, and its export digest verified. Repeated rows retained identical original Envio timestamps, consistent with block-cache reuse. These tests did not independently reacquire RPC responses on the test client or measure sustained load.

Provider quota and per-instance limits still apply. Cache reuse reduces avoidable requests; it does not guarantee availability under arbitrary traffic. No schema, UI, submitted links or bounty selection changed.
