# On-demand Envio HyperSync

This optional deployment mode is designed to remove the Mac worker, PostgreSQL host and tunnel from the application's data path; authenticated live integration remains unverified. It is selected by `ENVIO_DATA_SOURCE=hypersync`; the default remains `hyperindex`. Keep any running existing pipeline until the replacement passes real checks. Services already absent need not be restarted for the proof. Activation status and dated evidence are recorded in the [publication checkpoint](publication-checkpoint-2026-10-05.md).

## Data flow and provenance

Vercel read-only function → fixed official Monad HyperSync endpoint → bounded exact ABI normalization → activity UI / independent Monad receipt comparison.

Set `ENVIO_DATA_SOURCE=hypersync` to select this path. `ENVIO_API_TOKEN` must be a sensitive server-side variable, never a browser-prefixed variable, repository file, release asset or client response. Default `hyperindex` retains the existing SQL/bridge behavior. A failed HyperSync query remains unavailable; it does not fall back to the Mac, ordinary RPC logs or static data.

Recent activity queries a 16-block window below Envio's reported height. `watermark` means the block fully covered by this query, not a local SQL committed checkpoint. `engine`, `sourceUrl`, `windowStartBlock`, `providerHead` and `providerHeadObservedAt` identify the actual source and coverage. Despite its legacy field name, `providerHeadObservedAt` is the head block’s chain timestamp; `receivedAt` is the source-read start time. The reader verifies a fresh actual Envio head block, completes bounded pages and requires every scanned block. A cached response retains its original timestamp and expires within ten seconds or at the original head's freshness boundary, whichever is earlier.

For an older transaction, the independently fetched Monad receipt supplies only its block number as a query locator. HyperSync returns its own raw log/block rows; the receipt never supplies the Envio-side values. Full normalized values, hashes, timestamps and decoded parameters are compared. This does not establish viewer ownership, app execution or finality.

## Access and cost

Both [Monad networks are supported](https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks). Envio provides [one free personal token](https://docs.envio.dev/docs/HyperSync/api-tokens), and its [HyperSync Free package costs $0 with fair-use rate limits](https://envio.dev/pricing/hypersync). No paid package, overage, payment method or billable trial is required by this integration. Free-provider and Vercel Hobby quotas remain availability constraints. A free token is not an uptime or unlimited-volume guarantee.

Authenticated event queries are required on both networks. A successful public height read is not event-access evidence.

The captured Envio bounty permits HyperSync client code with a useful consumer and end-to-end demonstration. This architecture is a plausible fit; organizer primary-track eligibility and all other submission requirements remain separate.

## Activation verification

1. Configure the free token as sensitive server-side `ENVIO_API_TOKEN` in the existing Vercel project. Preserve the production source until actual queries pass.
2. Verify authenticated event queries on both networks and capture sanitized responses to confirm the flat `topic0..3` parser accepts the actual provider data. Offline tests alone do not establish live integration.
3. Activate `ENVIO_DATA_SOURCE=hypersync` and redeploy the existing project.
4. Run `EVIDENCE_DIR=/an/existing/evidence/directory node scripts/verify-mac-independent.mjs`. It reads only the existing public deployment and binds both networks to their expected chain, contract and provider origins. It validates that the supplied evidence directory already exists and is writable before any provider reads. It then polls for a real event for at most three minutes, failing rather than inventing one when the window stays empty. This narrow preview can miss sparse activity; no event found is an inconclusive discovery attempt, not proof that the source is broken. Unavailable or malformed evidence fails immediately; retry the verification after the source recovers rather than treating that run as a success. For each selected real event it waits at most three minutes for actual preview coverage to advance past that block, then requires an exact historical HyperSync lookup and matching canonical Monad receipt. It rechecks final source freshness, all selected event fields and the canonical digest. A stalled preview or unavailable source fails the check. It saves timestamped proof files using exclusive creation so before/after runs cannot overwrite each other. It does not configure credentials or stop services.
5. Stop only this project's previously identified local worker, bridge and tunnel; preserve all checkpoint/database files. Repeat the public proof after cache expiry. Record actual stopped services separately. If these services are already absent, record that state instead of claiming a shutdown; no restart is required for the proof. Remove the obsolete bridge environment setting after verified success.
6. Refresh demonstrations and submission descriptions around the actual deployed mode. Do not label prior HyperIndex footage as a HyperSync demonstration.

Prepared unit inputs are deliberately offline and are never served as runtime data or presented as real integration evidence.

The HyperSync read deadline is 20 seconds. Initial Envio and receipt/network reads run concurrently; canonical-block and targeted lookup phases remain bounded. This keeps their documented worst-case I/O budget below the existing 60-second function duration. Actual authenticated provider behavior remains an activation check.

Operator diagnostics use fixed sanitized reason classes with throttling. A short provider-failure cooldown suppresses repeated failing queries without returning stale evidence or falling back to another source. Actual authenticated responses on both networks remain required before activation. The [official query schema](https://docs.envio.dev/docs/HyperSync/hypersync-query) lists flat topic0 through topic3 fields; this supports the selected schema but is not live Monad response proof.
