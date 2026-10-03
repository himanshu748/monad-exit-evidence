# Dependency review — October 3, 2026

Fresh npm audit JSON is retained in `evidence/2026-10-03/`. Counts include transitive chains, not distinct exploitable bugs.

| Package group | Initial report | Action / final report |
| --- | --- | --- |
| Root | 0 | Unchanged; 0 |
| UI | 2 moderate | Vitest 3.2.7 → stable patched 4.1.11; 26 UI tests and production build pass; 0 |
| CRE | 1 moderate, 1 high | viem 2.38.5 → 2.57.2 (same version as root); real SDK typecheck and WASM compilation pass; 0 |
| Envio | 4 low, 1 moderate, 6 high | Retained HyperIndex 3.12.1; scoped Express 4.22.3 / viem 2.57.2 and esbuild 0.28.1 overrides; 0 |

[Vitest advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) identifies 4.1.11 as a patched stable release and explains the development-server conditions. [ws disclosure](https://github.com/advisories/GHSA-58qx-3vcg-4xpx) and [ws DoS](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) underpin the affected CRE dependency chain. The root/CRE current versions audit clean on this date; an audit is not a security certification.

Npm's offered Envio fix was a major downgrade to 2.32.12. Instead, retained HyperIndex 3.12.1 and applied scoped compatible runtime overrides: `envio -> express 4.22.3` and `envio -> viem 2.57.2`, plus the transpiler override `esbuild 0.28.1`. All four package groups now audit with zero reported vulnerabilities. The before and after reports remain evidence.

Reachability review of HyperIndex's actual Express server found static health/metrics/console routes, development-only cache synchronization, and no mounted body-parser, static-file or redirect middleware. Express query parsing could still reach qs, so it was patched rather than dismissed. The RPC configuration uses HTTP rather than the transitive ws transport. The esbuild finding concerned a Windows development server, absent from this Mac indexing path. These distinctions narrow the original exposure; they do not substitute for patching or certify security. Hasura remains disabled and PostgreSQL/health listeners bind loopback.

After updates: clean install audit, codegen, typecheck and all 13 Envio integration tests pass. The recent supervisor resumed its same persisted SQL window; both networks continued ingesting genuine events. Independent receipt/ABI decoding matched contract, block/log, chain and decoded fields on both networks (`envio-patched/receipt-cross-check.json`). Node 24 transitive Fuel engine warnings remain; this EVM-only run does not establish Fuel support.
