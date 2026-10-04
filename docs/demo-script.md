# Real integration demo — actual product only

Use the current product and actual provider responses. Old rehearsal recordings are historical and must not be used to describe this release. No screenshots/slides, fake responses, prefilled positions or generated execution outcomes should appear.

Before recording, keep one Envio supervisor running with a recorded window. Run `npm --silent run bounty:evidence`; check fresh market/book and Envio states. Build/start the product. The technical demo should remain below the previously reviewed general 3-minute limit; the pitch below 2 minutes. Detailed Perpl clip requirements still need portal confirmation.

1. Show the network, current public Perpl market and actual quoted book. Quantity and transaction inputs begin empty.
2. Enter a quantity deliberately and calculate against current quotes. Explain that this is quote analysis, with no inferred holdings, order dispatch or guaranteed fill.
3. Refresh activity and select a real Envio event. Show the explicit recent-window start and committed watermark.
4. Decode its real public transaction receipt and canonical block. Show the full index/chain comparison, including block hash, timestamp and every decoded parameter. If the event left the current exported page, keep the real page-absence status rather than claiming a match.
5. Export the unchanged observation JSON and inspect its actual ABI fields. Null account/market/quantity values remain unknown.
6. Switch network. Inputs/evidence clear; repeat with a real testnet observation. Show mobile readability.

Suggested narration: “Exit Evidence Workbench makes actual exchange data inspectable. These are current public Perpl quotes on Monad. Quantity is entered by the user; no wallet or position is assumed. Envio independently indexes selected real Exchange events into SQL. We select one public participant transaction, fetch its actual receipt and canonical block, decode the official ABI and compare the complete indexed record. The export preserves the observed values and source times. Public events are not proof of viewer ownership or execution by this app. Missing providers remain unavailable, and no sample outcome is substituted.”

## Pitch

Integrators need to distinguish a market quote, a request event and an observed fill. Exit Evidence Workbench puts actual public data and source checks in one readable place.

The current product combines public Perpl markets and books on Monad with real Envio-indexed exchange activity. A user can analyze quoted depth for an amount they enter, then inspect a real transaction against its receipt and canonical block. Every normalized indexed field is checked, and observations export with their timestamps and limitations.

Initial users are Monad trading-tool builders and protocol integration teams checking event adapters and data provenance. Proposed acquisition begins with reproducible tutorials and hands-on walkthroughs after approved release, then measures accurate interpretation of sources and repeat use on real integration issues. No existing traction is claimed.

The app reads data and does not trade, sign or infer wallet ownership. Envio is the strongest bounty integration; Perpl API and Analytics / Risk Tool eligibility need exact criteria. CRE is omitted, Nansen is unavailable without authorized access, and primary-track fit/public deployment remain completion gates.
