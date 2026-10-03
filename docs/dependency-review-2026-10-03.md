# Dependency review — October 3, 2026

Fresh npm audit JSON is retained in `evidence/2026-10-03/`. Counts include transitive chains, not distinct exploitable bugs.

| Package group | Initial report | Action / final report |
| --- | --- | --- |
| Root | 0 | Unchanged; 0 |
| UI | 2 moderate | Vitest 3.2.7 → stable patched 4.1.11; 26 UI tests and production build pass; 0 |
| CRE | 1 moderate, 1 high | viem 2.38.5 → 2.57.2 (same version as root); real SDK typecheck and WASM compilation pass; 0 |
| Envio | 4 low, 1 moderate, 6 high | Retained pinned HyperIndex 3.12.1; 11 unresolved, including transitive express/body-parser/path-to-regexp/qs/viem/ws chains |

[Vitest advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) identifies 4.1.11 as a patched stable release and explains the development-server conditions. [ws disclosure](https://github.com/advisories/GHSA-58qx-3vcg-4xpx) and [ws DoS](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) underpin the affected CRE dependency chain. The root/CRE current versions audit clean on this date; an audit is not a security certification.

Npm's offered Envio fix is a semver-major change to 2.32.12, a downgrade from the tested 3.12.1 runtime. This review did not force that downgrade or apply untested overrides to pinned vendor internals. The transitive dependencies remain a release-review gate. Hasura is disabled; PostgreSQL and the now-verified health listener bind loopback. HTTP public RPC indexing is used, not authenticated WebSocket trading. These narrow the exercised exposure but do not prove the dependencies safe or replace a patched vendor release. The Windows-specific esbuild report is not exercised on this Mac.

The full remaining advisory URLs, ranges and dependency edges are in `envio-audit.json`. Reassess a compatible upstream HyperIndex release or isolated overrides with fresh codegen, typechecks, live indexing, receipt cross-checks and restart validation before any hosted release. Fuel transitive engine warnings from Node 24 are historical install warnings; this EVM-only run does not establish Fuel support.
