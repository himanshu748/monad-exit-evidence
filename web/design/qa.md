# Frontend verification record

## Scope

Entry route → load live public liquidity → review hypothetical integer limits → run a labeled replay → inspect observed quantities → export unchanged JSON and verify integrity. All six scenarios remain explicit. No production trades or provider writes exist in this interface.

## Unit and component evidence

Initial RED: 19 tests failed against empty UI/form implementations, including exact conversion, invalid decimal rejection, accessible form labels, disabled execution before review, pending state, partial/unknown copy, network reset, retry identity, provider failure, absent indexer and integrity verification.

First GREEN: 19/19 passed. Follow-up RED caught editable form/market controls while a replay was pending. GREEN: 21/21 with all context-changing controls disabled during the request and added reload/repeated-review identity coverage.

Validation RED caught leading-zero decimal input and values exceeding the backend's supported integer/precision bounds. Fixed the form to match unsigned 128-bit quantities, canonical plain decimals, and at most 18 decimal places. Final frontend suite: 23/23 passing. Root suite also passed: 48/48. Production build and TypeScript compilation passed.

## Visual system

Generated using built-in Image Gen. Reference path: `exit-evidence-concept.png`, native 1536 × 1024. The concept was inspected with `view_image`. The app uses a 208px dark navigation rail, warm #F6F4EF canvas, nearly white surfaces, 36px page title, tabular quantities, 6px corners, and restrained green/amber/red text states. See `design-system.md` for inventory.

## Browser verification blocker

Cloud Browser was attempted first. `http://localhost:5173` navigation returned `net::ERR_BLOCKED_BY_CLIENT`.

Local Playwright Chromium was then attempted for the task's requested browser validation. Chromium exited during launch with `socket() failed: Operation not permitted` and a crashpad directory error. A reviewed `require_escalated` launch returned the same runtime socket restriction. No further attempts at that restriction were made.

Vite's initial 0.0.0.0 development bind also hit `uv_interface_addresses` permission restrictions. The documented host is now explicit loopback; the production browser smoke uses the Node backend directly and does not depend on Vite.

## Fidelity ledger: unverified rendered side

1. Layout: reference two-column workbench and full-width activity band mapped to matching CSS; rendered comparison blocked
2. Palette: exact canvas, rail, border and semantic tokens mapped; rendered comparison blocked
3. Typography: semantic heading hierarchy, explicit control sizes and tabular numeric figures implemented; rendered comparison blocked
4. Containers: flat border-only panels, table structure and low-radius controls preserved; rendered comparison blocked
5. Responsiveness: single-column breakpoint and mobile navigation styles implemented; actual overflow/screenshot check blocked
6. Copy: generated mock data removed; only real API public values appear in production; rendering not yet checked

Intentional functional deviations: required Run rehearsal action, snapshot review, source metadata, error/loading states, all six scenarios, collapsed full evidence checks, JSON inspector and integration gates. The screenshot's sample public rows are excluded from shipped code. Source status uses server fields, never decorative success badges.

**Do not describe the browser workflow, mobile layout, screenshots, or visual fidelity as verified until the smoke runs successfully in an authorized browser environment.**

## Mac browser verification — 1 October 2026

The historical cloud blocker above is superseded for this Mac run. Production browser smoke passed with real public Perpl reads, six rehearsals, receipt checks, unchanged export, reload identity, network reset and mobile overflow check. Desktop and mobile screenshots were visually inspected. See ../../docs/mac-validation-2026-10-01.md for exact commands, compiler workaround and remaining integration limits.
