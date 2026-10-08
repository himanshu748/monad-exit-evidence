# Submission text, ready to paste

Plain-language versions of the Metropolis form fields. Everything here describes what the deployed app does today; nothing is claimed that the repo does not show. Character limits are the form's own (checked 8 October 2026). Fill the two video links and the AI-tool names before pasting.

Prepared track: **Trust, Identity & AI Infrastructure** (provenance for onchain data). Bounty: **Best Use of Envio** only. The Perpl API and Analytics bounties are not met, so do not add them.

---

## Project name (≤120)

Exit Evidence Workbench

## One-line description (≤200)

Check any Perpl exchange event on Monad against its real receipt: live order books, Envio HyperSync activity and a field-by-field chain comparison, all read-only.

## Description (≤8,000)

**The problem.** On a fast chain like Monad, integrators and traders lean on indexed data, but an indexed row is only a claim. An order request is not a fill, a quote is not an execution, and a decoder bug or a stale indexer silently turns one into the other. Today you check that by hand: copy a hash, open an explorer, decode the log, compare.

**What Exit Evidence Workbench does.** It puts the market, the indexed activity and the proof in one page, on Monad mainnet and testnet:

1. **Market.** Live Perpl market configuration and order books. Type a size to see the quoted depth for it. This is quote analysis, never a fill.
2. **Activity.** Recent Perpl Exchange events (order requests, maker and taker fills, position closes and decreases) read through Envio HyperSync, showing the exact block window covered.
3. **Evidence.** Pick any event. The server fetches its transaction receipt and canonical block from Monad RPC on its own, decodes the log with Perpl's official ABI, and compares every field with the Envio record: block hash, timestamp and every decoded parameter. You get a clear match, or the exact field that differs.
4. **Export.** Download the observation as JSON with source timestamps and a change-detection digest.

If any source is down or stale, the app says "unavailable". It never falls back to sample data, and it has no wallet, signing or trading path.

**Who it is for.** Teams building trading tools, risk dashboards and protocol integrations on Monad who need to trust their event adapters, and anyone who wants to see what actually happened on Perpl rather than what a feed says happened.

**How it is built.** React/Vite front end; a read-only Node 24 function on Vercel; Envio HyperSync for exchange logs on both Monad networks; Monad public RPC for receipts and blocks; viem for strict ABI decoding; Perpl's public API for markets and books. The repo also contains an Envio HyperIndex indexer (config, schema, handlers for 8 Exchange events on two chains) that ran as a local worker during development. Backend regression tests cover parsing, provenance, freshness and failure handling.

**Built during Metropolis.** The repository was created on 1 October 2026 and its full history is public. AI coding tools were used and are disclosed in the README: [NAME THE TOOLS].

Live app: https://monad-exit-evidence.vercel.app
Code: https://github.com/himanshu748/monad-exit-evidence

## Go-to-market and user acquisition (≤8,000)

**First users.** Monad trading-tool developers and protocol integration teams who maintain event adapters, starting with builders on Perpl.

**Weeks 1–2.** Publish one reproducible walkthrough: take a real Perpl transaction, compare its Envio record with the receipt, and explain the result. Invite 5 to 8 integration developers to a short guided session, and ask them to check one event and export it.

**Weeks 3–4.** Fix the hardest step those sessions reveal, run two small workshops in the Monad and Envio developer communities, and publish one independently reproducible receipt check.

**How we will measure it.** Session completion, time to tell a request from a fill, correct reading of freshness and coverage gaps, and repeat use on a second real integration issue. Goals: 4 of 6 builders finish the checks unaided, and 2 come back with a real adapter or provenance issue.

**Where it can go.** A hosted API that any Monad app can call to verify an indexed event before acting on it, extended to more Monad protocols beyond Perpl.

These are plans; there are no users, partnerships or traction yet.

## Envio bounty answer

Envio is the data backbone of the app's activity and evidence features.

- **HyperSync drives the product.** `src/data/envio-hypersync.ts` queries Envio HyperSync on Monad mainnet (`monad.hypersync.xyz`) and testnet (`monad-testnet.hypersync.xyz`) for the Perpl Exchange contract. It requires complete coverage of every block it scans, normalizes 8 event types with exact ABI quantities, and caches only within strict freshness limits. Missing or stale reads stay "unavailable", with no fallback.
- **It powers a real feature, not just a display.** Every event can be checked against an independently fetched Monad receipt and canonical block; older events are looked up again in HyperSync by block. The comparison covers block hash, timestamp and every decoded field.
- **HyperIndex too.** `integrations/envio/` contains `config.yaml`, `schema.graphql` and idempotent handlers for both chains, run during development as a local indexer, plus `config.cloud.yaml` for Envio Cloud. [If you deploy it, add: "Hosted on Envio Cloud at <GraphQL endpoint>."]
- **Try it:** https://monad-exit-evidence.vercel.app, or the raw JSON at `/api/activity?network=mainnet` and `?network=testnet`.

## Judge access instructions (optional)

No login needed. Open https://monad-exit-evidence.vercel.app, choose a network, open Activity, pick any event and run the evidence check. If the activity panel shows "unavailable", it cannot currently provide fresh, complete, validated indexed data. Possible causes include rate limits, missing or invalid credentials, provider errors, and stale or incomplete data. Waiting a minute and refreshing may help with a temporary failure, but it is not a guaranteed fix. If the problem persists, the operator should check the server diagnostics and configuration. The app never shows sample data instead.

## Videos

- Technical demo (≤3 min, public or unlisted): [LINK]
- Pitch (≤2 min): [LINK]
- Optional Envio bounty video (≤2 min): the technical demo's Activity → Evidence segment works for this.
