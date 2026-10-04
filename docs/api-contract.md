# Current read-only API contract

All responses use `{data: VALUE|null, error: null|{code,message}, meta:{receivedAt}}`. The app serves actual provider observations or explicit errors/unavailable states.

- GET `/api/health`: `LIVE_READ_ONLY`, simulationEnabled false, tradingEnabled false; actual Envio status per network; Perpl public-read-configured; CRE omitted-user-choice; Nansen access-required.
- GET `/api/markets?network=mainnet|testnet`: real public Perpl context and precision, source URL/time, stale flag and human decimal market values.
- GET `/api/book?network=&marketId=`: actual public book levels, source timestamps/precision and context freshness. No quantity or estimate is assumed.
- GET `/api/liquidity?network=&marketId=&quantity=&direction=long|short`: quoted depth for a quantity explicitly supplied by the user. Long exit consumes bids; short consumes asks. This never submits an order or guarantees a fill.
- GET `/api/activity?network=`: fresh validated full normalized Envio events, chain ID, committed watermark and optional explicit window start. Missing/stale indexer yields unavailable, null watermark and no events.
- GET `/api/observations?network=&transactionHash=&logIndex=`: independent public Monad receipt/canonical block and strict ABI decode. Complete normalized event comparison yields INDEX_AND_CHAIN_MATCH, SOURCE_MISMATCH or CHAIN_OBSERVED. Absence from the current page is NOT_IN_CURRENT_PAGE. Missing ABI fields remain null. Exact observation export includes source timestamps/checks/limitations and a change-detection digest.
- GET `/api/nansen/status`: access-required; never a live portfolio badge.
- Opt-in local GET `/api/indexer-snapshot?network=`: validated public SQL fields/progress for the deployment bridge; disabled by default and on Vercel. No runtime path or database access is returned.
- `/api/rehearsals` and `/api/receipts/verify`: HTTP 410 SIMULATION_REMOVED.
- All other API methods: 405 READ_ONLY. Public mode capacity exhaustion: 429 READ_LIMIT with Retry-After. No trading route or arbitrary upstream is accepted.

Inputs start empty. Switching networks clears quantities/transaction evidence; stale asynchronous reads cannot replace edited inputs. Exports contain the unchanged returned observation JSON. Public participant events establish neither viewer ownership nor an execution performed by this app.
