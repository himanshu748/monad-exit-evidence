# Exit Evidence Workbench

A read-only Monad workbench for reviewing exact position-reduction limits, understanding live Perpl liquidity, and inspecting execution evidence. **Mandate is an internal codename; no public name clearance is claimed.**

## What works now

- Live Perpl mainnet/testnet market configuration and order-book depth, with source, timestamp, exact units and stale/error states
- Immutable hypothetical limit review and six clearly labeled rehearsals: valid reduction, unauthorized open, partial fill, interrupted response, duplicate request and receipt tampering
- Independent deterministic policy checks, bounded integer arithmetic, SQLite idempotency across restart, retained unknown reservations and exact receipt integrity checks
- Real Envio HyperIndex ingestion on both Monad networks. The activity feature consumes fresh Envio-committed SQL data, not static fixtures or a direct-RPC substitute
- A typed Nansen balance/budget adapter, with account/network/freshness checks and no live access configured
- A genuine read-only Chainlink CRE SDK workflow for narrow public position-decrease observations. Typechecking, predicate tests and real WASM compilation pass; no actual CRE CLI simulation is claimed, and its bounty is omitted by user choice

## Important distinctions

Rehearsal approvals are **not owner signatures**, and executions are **not trades**. Receipt hashes detect changed bytes; they do not authenticate the owner or prove real financial execution. Public exchange activity belongs to arbitrary participants, not the viewer or the rehearsal. An order request is not a fill. Missing evidence is unknown, not success.

Reducing a position can realize losses or remove a hedge. Liquidity estimates are snapshots, not guaranteed fills or financial advice. This project has no signing keys, wallet integration, trading API route, payment fallback or real-money automation.

## Run

Use Node 24 or newer. From the project root:

```sh
npm ci
npm --prefix web ci
npm --prefix web run build
npm start
```

Open http://127.0.0.1:4100. The server binds only to loopback by default. For UI development, run the server and `npm --prefix web run dev` together; Vite proxies `/api` to port 4100. Environments with isolated process/network namespaces may need both commands launched in one supervised shell.

For a resumable recent window on this Mac, run `npm --prefix integrations/envio run start:recent` (only one indexer at a time). Public RPC outages can leave the activity panel unavailable. For live activity, follow [Envio setup](integrations/envio/README.md). It requires no external token: HyperIndex runs against public Monad RPC with an isolated PostgreSQL instance. It is a temporary foreground development process, not a permanently hosted service.

## Verify

```sh
npm test
npm run typecheck
npm --prefix web test
npm --prefix web run build
npm --prefix integrations/envio ci
npm --prefix integrations/envio run codegen
npm --prefix integrations/envio run typecheck
npm --prefix integrations/cre ci
npm --prefix integrations/cre run typecheck
```

See [evidence and limitations](docs/evidence.md), [security boundaries](docs/security.md), [CRE gate](integrations/cre/README.md), and [browser QA status](web/design/qa.md).

## Hackathon scope

Historical primary track: Onchain Finance & Trading; current eligibility remains unconfirmed because the local read-only product has no app-owned deployed onchain mechanism or settlement. Metropolis allows Monad mainnet or testnet and requires public source, a deployed live product, technical demo <=3 minutes and pitch <=2 minutes. Deadline October 13, 2026 at 11:59 PM ET (October 14 03:59 UTC). Proposed minimal bounty set: Envio only, conditional on public source/pipeline/demo deliverables. CRE is omitted by user choice; Nansen is omitted without live access. Local independent review, regression/browser checks, patched dependency audits and genuine Envio receipt cross-checks are complete. Local videos are prepared separately; no hosted link or completed submission is claimed. Previously blocked push/upload still requires direct approval. No public deployment or financial transaction has been made. See [submission draft](docs/submission-draft.md), [local completion](docs/local-completion-2026-10-03.md) and [GTM plan](docs/go-to-market.md).

See [current local readiness](docs/local-completion-2026-10-03.md), [demo script](docs/demo-script.md), and [submission draft](docs/submission-draft.md). All materials remain local; the historical source ZIP predates this completion work.

## Source provenance

Perpl interfaces are grounded in its [official API docs](https://github.com/PerplFoundation/api-docs) and [official exchange SDK](https://github.com/PerplFoundation/dex-sdk). Envio's copied ABI has source/commit provenance in its module README. Data redistribution restrictions still apply to any later authenticated Nansen integration; no restricted Smart Money data is used.
