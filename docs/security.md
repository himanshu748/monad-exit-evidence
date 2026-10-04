# Current security and truthfulness boundaries

The current production app is a public read-only data inspector. Legacy rehearsal routes return 410; all API methods other than GET return 405. Historical generators are isolated under tests/legacy. No wallet, signature, trade, private key, account credentials or payment adapter is exposed.

## Enforced boundaries

- Fixed public Perpl and Monad upstreams; redirects rejected, request timeouts and streaming response byte limits. User input cannot supply an upstream URL.
- Strict network/contract/chain ID, quantity precision, successful receipt, canonical block and ABI/event provenance validation. Full indexed fields are compared, including block hash, timestamp and decoded arguments.
- Envio SQL events and committed progress come from one read-only repeatable-read transaction. Age/progress/decoded/duplicate checks remain required after remote transport. Missing/stopped/stale source stays unavailable.
- A deployment-configured HTTPS trycloudflare origin may transport those actual SQL snapshots. The local raw-snapshot endpoint is opt-in and returns only whitelisted public exchange/progress fields; it strips local runtime names and is disabled on Vercel. The tunnel server runs ENVIO_BRIDGE_ONLY=1; its frontend, other APIs and provider proxies are blocked. Exact transaction lookup is a bounded read-only repeatable-read query of the actual entity and committed progress on loopback PostgreSQL. No database/indexer port is published.
- Public APIs enforce 120 admissions per minute and at most six concurrent requests per instance, bound URL length and suppress internal error details. Limits are per instance, not a distributed or per-person anti-abuse guarantee; platform protections remain relevant.
- Vercel serves the built frontend and a read-only API function. CSP restricts scripts/connect origins, frames and base URI. No permissive CORS; no-referrer and disabled camera/microphone/geolocation permissions. The server binds loopback locally.
- Nansen remains access-required. CRE is omitted by user choice. No mock portfolio, sample execution or historical proof is served as live data.

## Hosting limits and threat model

The local Envio worker, database and bridge must keep running. A quick tunnel is temporary and can stop or change URL; it is not a durable hosted indexer. A disconnected bridge fails closed. Before final submission, confirm a sustained worker/bridge or approve a proper persistent worker/database host. The app does not install a daemon, open a database port, create a persistent token or authorize spending.

Public provider responses, the deployment configuration and indexer host are trusted observations. Independent receipt comparisons narrow consistency uncertainty, not provider collusion or finality. A digest detects export changes but does not establish owner identity or app execution. Book depth is a quote calculation, never a guaranteed fill. A request event remains a request.

There is no multi-user private data or trading state to protect, and no authenticated user account feature. Public request metadata may be retained by hosting providers under their policies; no new application access log or wallet retention store is introduced. Independent review and passing checks are bounded assurance, not a security certification. Sponsor eligibility requires current signed-in rules.
