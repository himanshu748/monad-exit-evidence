# Mac validation — 1 October 2026

Restored the complete source archive from private repository commit caa057316298536243e3962a14ac4d2c41f940f7, whose source provenance is cloud checkpoint 7f53909003cb62968de18d26c8961ca01e6ab917. ZIP paths and symlinks were checked before extraction. No AGENTS.md, CONTRIBUTING.md or .agents instructions were present.

Validated on macOS arm64, Node v24.9.0, npm 11.6.0, around 17:25 UTC. No application behavior was changed. The browser harness now follows the explicit separate-rehearsal action after an unknown outcome, selects Network by its accessible combobox name, and finds cached Playwright Chromium on Mac when CHROMIUM_PATH is unset.

Commands and results:

- `npm ci`, `npm --prefix web ci`, `npm --prefix integrations/cre ci`, `npm --prefix integrations/envio ci`: completed.
- `npm test`: 60/60 passed with loopback permitted. Sandbox-only run had four EPERM socket failures.
- `npm run typecheck`: passed after restoring the missing pinned Mac compiler package locally. npm silently omitted this optional binary despite retry; dependency files were unchanged. Workaround: `npm pack @typescript/typescript-darwin-arm64@7.0.2 --pack-destination /tmp`, then extract its package into `node_modules/@typescript/typescript-darwin-arm64` with `--strip-components=1`. npm reported integrity matching the lockfile.
- `npm --prefix web test`: 26/26 passed.
- `npm --prefix web run build`: passed (35 modules; 247.17 kB JS, 76.76 kB gzip).
- `npm --prefix integrations/cre run typecheck`: passed.
- `npm --prefix integrations/envio run codegen` and `npm --prefix integrations/envio run typecheck`: passed.
- `npm --prefix web run format:check`: passed.
- `npm --prefix web run test:browser`: passed against real public Perpl reads, production backend, cached Chromium. Six scenarios, integrity/tamper detection, unchanged export, reload receipt identity, network review reset, desktop 1536×1024 and mobile 390×844. Zero browser errors, no mobile horizontal overflow, all rehearsals report zero provider writes. Screenshots and browser-results.json are in web/design.

Desktop and mobile screenshots were visually inspected: readable controls, clear hypothetical-position and partial-result boundaries, explicit unavailable Envio state. This is bounded smoke validation, not exhaustive accessibility or integration QA.

Remaining: Envio live indexing has not been started on Mac; CRE actual CLI simulation remains unauthenticated; Nansen remains mocked; public deployment and submission evidence remain pending. Install audit reports: root 0 vulnerabilities, web 2 moderate, CRE 1 moderate/1 high, Envio 4 low/1 moderate/6 high. No forced dependency updates were applied. Several Envio transitive Fuel packages warn that Node 24 is outside their advertised engine range, despite successful codegen/typecheck.

Run from this folder with `npm start`, then open http://127.0.0.1:4100. The production UI has already been built. Network access is needed for live public reads. No keys, wallet transactions, trades, paid services or public deployment were used.
