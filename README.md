# Exit Evidence Workbench

A read-only Monad workbench for actual Perpl market data, Envio exchange activity when a fresh genuine source is available, and independently decoded public transaction evidence.

## Real integration behavior

- Public Perpl market configuration and order-book quotes on Monad mainnet and testnet, with actual source URLs, precision, timestamps and stale/error states.
- Optional depth calculations for a quantity entered by the user, computed from current public quotes. No position, wallet balance or order outcome is assumed.
- Genuine Envio HyperIndex ingestion into PostgreSQL. Atomic SQL exports carry committed progress, the explicit recent-window start and full normalized event provenance. Stale or missing activity is unavailable, with no inferred events.
- A public transaction inspector independently fetches network ID, transaction receipt and canonical block, strictly decodes a supported Perpl Exchange log, and compares the complete normalized event with the fresh Envio page. Block hashes, timestamps and every decoded parameter are included in the comparison.
- Exact observation JSON exports with a change-detection digest and explicit provenance limitations.

The production app has **no simulated execution controls, sample positions, prefilled transaction, generated fills or fixture data fallback**. Legacy rehearsal and receipt-verification routes return HTTP 410. Historical rehearsal generators live only in `tests/legacy` for offline regression history; the runtime does not import or serve their generated outcomes. Unit test inputs are not integration evidence. Selected workbench and HTTP/RPC integration tests, plus browser smoke, use real provider reads. Parser, state, route, timeout and failure-handling regressions use explicitly offline test inputs; those inputs are never served by the app or presented as integration evidence.

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

Optional [on-demand HyperSync mode](docs/mac-independent-hypersync.md), selected by `ENVIO_DATA_SOURCE=hypersync`, is designed to read directly from Envio without a Mac worker or tunnel. It is unverified against authenticated live data. The default `hyperindex` mode uses the SQL/bridge pipeline. Authenticated reads and independent receipt checks are required before switching sources. See the [dated publication validation](docs/publication-validation-2026-10-05.md) for activation status and the limits of existing evidence.

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

Backend tests use an explicit `tsx` loader, which avoids unknown `.ts` extensions in independent Node 22 review shells. Node 24.x remains the verified app/indexer and deployment runtime. Selected HTTP/workbench integration checks use actual public providers; the unit and DOM suites also contain explicitly offline regressions. Browser smoke additionally requires fresh Envio activity and verifies real indexed transactions on both networks, exact export, network reset and mobile layout. Use `EVIDENCE_DIR` to save new browser proof separately from previous/user screenshots. The bounty command gathers real quotes and current Envio data without any sample quantity; its data readiness is not submission eligibility. See [bounty proof packet](docs/bounty-evidence.md).

## Bounty and submission scope

The strongest fit is **Best Use of Envio**. Its HyperIndex path was demonstrated historically; HyperSync remains unverified. The October 5 post-deployment check recorded unavailable activity on both networks; see the [dated validation](docs/publication-validation-2026-10-05.md). The saved October 4 signed-in rules require real bot execution for Perpl's API bounty and combined protocol/wallet portfolio dashboards for its Analytics / Risk bounty. This product does not satisfy those Perpl deliverables. See [saved rules and fit](docs/hackathon-rules-2026-10-04.md). CRE is omitted by user choice; Nansen has no authorized live transport.

App: https://monad-exit-evidence.vercel.app. Unavailable sources fail closed. The [dated publication validation](docs/publication-validation-2026-10-05.md) records the published source, deployment, provider availability and prepared Deepgram narration over historical HyperIndex footage. Sustained availability, primary-track eligibility, qualifying hosted video URLs and participant agreements remain final-submission requirements. The saved October 4 signed-in dashboard gives October 14, 2026 at 09:29 GMT+5:30 / October 13 at 23:59 Eastern as the deadline. The saved October 4 rules state that registration closes October 6; confirm participant registration. No completed hackathon submission or financial transaction is claimed.

Prepared materials: [submission draft](docs/submission-draft.md), [demo script](docs/demo-script.md), [Deepgram media status](docs/publication-validation-2026-10-05.md#deepgram-media), and [GTM proposal](docs/go-to-market.md). The [real integration validation](docs/real-integration-validation-2026-10-04.md) records historical HyperIndex observations. October 1–3 rehearsal recordings and validation notes are historical and do not represent the current real-only product.

Perpl interfaces use its [official API docs](https://github.com/PerplFoundation/api-docs) and [exchange SDK](https://github.com/PerplFoundation/dex-sdk). Envio ABI source/commit provenance is documented in its module README. Public hosting requires the [deployment/security review](docs/security.md); local review is bounded assurance.

The frontend provides an overview at `/`, with the workbench at `/#workbench` and preserved `/#activity` and `/#evidence` section links. Its network cards read only actual Envio indexed activity and report loading, unavailable, failed and stale states separately. The overview does not establish quote availability, whole-chain health, app-executed trades or complete historical coverage.
