# Exit evidence frontend

Read-only React/Vite workbench for real public Perpl liquidity and explicitly simulated close-only outcomes. All quantities and price limits used in review are resolved with integer arithmetic. There is no wallet connection, signing, or trading action.

## Run

From the repository root, with Node 24+:

```sh
npm ci --cache /tmp/mandate-npm-cache
npm --prefix web ci --cache /tmp/mandate-npm-cache
npm --prefix web run build
npm start
```

Open `http://127.0.0.1:4100`. The backend serves the built frontend. For development, run `npm start` and `npm --prefix web run dev`; Vite uses `http://127.0.0.1:5173` and proxies `/api` to port 4100. Neither command publishes the app.

## Verify

```sh
npm --prefix web test
npm --prefix web run build
npm --prefix web run format:check
npm test
npm --prefix web run test:browser
```

The browser smoke script starts an isolated backend on port 4180 and uses `/usr/bin/chromium` when present, otherwise cached Playwright Chromium. Set `CHROMIUM_PATH`, `SMOKE_PORT`, or `EVIDENCE_DIR` if needed. It exercises six scenarios against real public Perpl reads, JSON verification/export, reload recovery, network reset, and 1536 × 1024 / 390 × 844 layouts. Public data failures correctly fail this smoke rather than substituting fixtures.

## Current evidence and remaining gate

- UI/form tests and the production build were verified in this environment. See `design/qa.md` for the exact scope.
- Browser verification passed on this Mac on October 1 and was refreshed October 3: six real-public-data scenarios, receipt/export/reload identity, network reset, zero browser errors, no mobile overflow. Fresh screenshots and results are in `../docs/evidence/2026-10-03/browser/`. The older cloud blocker is superseded for these bounded Mac checks.
- `design/exit-evidence-concept.png` is a generated design reference with concept-only data, not an application screenshot or actual execution evidence.

## Important behavior

- Inputs describe a hypothetical position, not the user's holdings.
- Review freezes decimals, integer-resolved values, network, market, direction, scenario, and market snapshot. Editing invalidates that review.
- A request's idempotency key and reviewed body are retained in session storage. A lost response or reload can recover the same recorded result. Repeated review clicks do not generate another key.
- Partial and unknown outcomes are not presented as completion. Reservation quantities and checks come from the returned receipt.
- Export saves the unchanged returned receipt. Editing the JSON inspector affects verification only.
- A valid SHA-256 digest means internal consistency only. It does not establish owner authentication or actual execution.
- Envio shows only the API's actual availability and events. CRE login and Nansen access gates remain explicit.
