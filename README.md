# Exit Evidence Workbench

A read-only Monad workbench for actual Perpl market data, real Envio-indexed exchange activity and independently decoded public transaction evidence.

## Real integration behavior

- Public Perpl market configuration and order-book quotes on Monad mainnet and testnet, with actual source URLs, precision, timestamps and stale/error states.
- Optional depth calculations for a quantity entered by the user, computed from current public quotes. No position, wallet balance or order outcome is assumed.
- Genuine Envio HyperIndex ingestion into PostgreSQL. Atomic SQL exports carry committed progress, the explicit recent-window start and full normalized event provenance. Stale or missing activity is unavailable, with no inferred events.
- A public transaction inspector independently fetches network ID, transaction receipt and canonical block, strictly decodes a supported Perpl Exchange log, and compares the complete normalized event with the fresh Envio page. Block hashes, timestamps and every decoded parameter are included in the comparison.
- Exact observation JSON exports with a change-detection digest and explicit provenance limitations.

The production app has **no simulated execution controls, sample positions, prefilled transaction, generated fills or fixture data fallback**. Legacy rehearsal and receipt-verification routes return HTTP 410. Historical rehearsal generators live only in `tests/legacy` for offline regression history; the runtime does not import or serve their generated outcomes. Unit test inputs are not integration evidence. The UI tests, HTTP/RPC checks and browser smoke use real provider reads.

Public events describe their participants, not the viewer or an execution performed by this app. An OrderRequest event is a request, not a fill. Canonical-block checks are point-in-time provider observations, not finality guarantees. A digest does not authenticate an owner. This app has no wallet, signing, trading or payment path.

## Run

Use Node 24.x (the `.nvmrc` and `.node-version` files select that major):

```sh
npm ci
npm --prefix web ci
npm --prefix web run build
npm start
```

Open http://127.0.0.1:4100. The server binds loopback. Live provider reads require network access; unavailable reads stay unavailable.

For indexed activity, follow [Envio setup](integrations/envio/README.md). Resume the existing window with `npm --prefix integrations/envio run start:recent`. To deliberately start a distinct recent window, use `npm --prefix integrations/envio run start:recent -- --window oct04-live`. Run only one supervisor at a time. Each named window records real RPC heads/start blocks and uses its own persisted database/schema; it does not reset previous checkpoints. Restarting the same name resumes that window. Foreground processes are temporary, not permanently hosted services.

## Verify

```sh
npm test
npm run typecheck
npm --prefix web test
npm --prefix web run build
npm --prefix web run format:check
npm --prefix web run test:browser
npm --silent run bounty:evidence
```

Backend tests use an explicit `tsx` loader, which avoids unknown `.ts` extensions in independent Node 22 review shells. Node 24.x remains the verified app/indexer and deployment runtime. HTTP/UI checks use actual public providers. Browser smoke additionally requires fresh Envio activity and verifies real indexed transactions on both networks, exact export, network reset and mobile layout. Use `EVIDENCE_DIR` to save new browser proof separately from previous/user screenshots. The bounty command gathers real quotes and current Envio data without any sample quantity; its data readiness is not submission eligibility. See [bounty proof packet](docs/bounty-evidence.md).

## Bounty and submission scope

The strongest demonstrated target is **Best Use of Envio**. The current signed-in rules require real bot execution for Perpl's API bounty and combined protocol/wallet portfolio dashboards for its Analytics / Risk bounty. This product does not satisfy those Perpl deliverables. See [current rules and fit](docs/hackathon-rules-2026-10-04.md). CRE is omitted by user choice; Nansen has no authorized live transport.

Live app: https://monad-exit-evidence.vercel.app. The Envio bridge depends on this Mac's running worker and a temporary tunnel; unavailable sources fail closed. Continued hosting, primary-track eligibility, qualifying hosted video URLs and participant agreements remain final-submission gates. The signed-in dashboard gives October 14, 2026 at 09:29 GMT+5:30 / October 13 at 23:59 Eastern as the deadline. Public source/app publication was explicitly approved after an accidental keep-local response. No completed hackathon submission or financial transaction is claimed.

Current materials: [submission draft](docs/submission-draft.md), [demo script](docs/demo-script.md), [GTM proposal](docs/go-to-market.md), and [real integration validation](docs/real-integration-validation-2026-10-04.md). October 1–3 rehearsal recordings and validation notes are historical and do not represent the current real-only product.

Perpl interfaces use its [official API docs](https://github.com/PerplFoundation/api-docs) and [exchange SDK](https://github.com/PerplFoundation/dex-sdk). Envio ABI source/commit provenance is documented in its module README. Public hosting requires the [deployment/security review](docs/security.md); local review is bounded assurance.
