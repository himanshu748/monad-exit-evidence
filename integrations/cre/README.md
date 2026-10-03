# Read-only CRE exit-observation verifier

This is real CRE SDK code, not a mock workflow. It combines `HTTPClient` (Perpl public context) and `EVMClient.getTransactionReceipt` (Monad) to compare a declared scope with independently fetched position-decrease evidence. It supports the official `PositionDecreased` event and returns UNKNOWN/inconclusive for unsupported evidence, including `PositionClosed` without an attributable quantity.

The claim includes the full supported policy preimage (schemaVersion 1, chainId, exchange, accountId, marketId, authorizedCloseQuantity). The verifier recomputes its canonical SHA256 digest and requires all claim fields to match. It also binds transaction identity. It does **not** verify owner signatures, agent attribution or finality. The result is a narrowly named public observation, never proof that this app submitted a trade. Configuration is testnet by default. No wallet key, write capability, `--broadcast` path or signing code exists.

## Verified locally

- `@chainlink/cre-sdk` 1.23.0 pinned in package-lock.json
- TypeScript typecheck passes using the real SDK interfaces
- Five core predicate tests pass, including wrong-chain/contract/transaction, quantity overrun, stale HTTP data, missing evidence and conflicting duplicate log
- Historical cloud run: official CRE CLI 1.35.0 was downloaded and its published SHA256 verified
- That historical CLI simulation attempt stopped before execution with `Authentication required: not logged in and no CRE_API_KEY set`

**No successful CRE CLI simulation or DON deployment is claimed.** October 3 on Mac: the real SDK/Javy build now produces WASM after keeping the parameterized HTTP handler internal (exporting it caused `Exported functions with parameters are not supported`). `npm run build:wasm` is reproducible with Bun. See `../../docs/evidence/2026-10-03/cre-wasm-build-green.txt` and the WASM SHA256 manifest. A real public testnet claim also passed local predicates; this is not an authenticated CRE simulation.

User chose to proceed without the CRE bounty on October 3. The steps below remain optional development instructions; simulation is not claimed and is not required for the current minimal bounty set.

## After user-controlled authentication

1. Install CRE CLI from its [official installation guide](https://docs.chain.link/cre/getting-started/cli-installation).
2. Sign in personally using `cre login`. Do not place credentials in chat or source control.
3. Run `npm ci` in this directory.
4. Prepare a real claim JSON from a supported `PositionDecreased` event on Monad testnet. Quantities are exact integer lot units, not human decimals. Include chainId 10143, exchange, transactionHash, accountId, marketId, authorizedCloseQuantity a policy object with schemaVersion 1, chainId, exchange, accountId, marketId and authorizedCloseQuantity; and the exact 64-character lowercase SHA256 policyDigest of that canonical policy. The exported exitPolicyDigest helper produces this digest.
5. With the recent Envio supervisor running and fresh, run `npm run prepare:claim` here. It reads an actual `PositionDecreased` event, independently decodes the public receipt, and saves `.runtime/claim.json` plus provenance. Its policy is hypothetical over arbitrary public activity, never owner approval. If a supported event or fresh context is missing, it stops rather than inventing evidence.
6. Run `cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0 --http-payload @.runtime/claim.json`. Preserve actual CLI output, including any inconclusive/failed result. Do not pass `--broadcast` or supply a signing key.

The HTTP trigger intentionally permits empty authorization for local simulation. Do not deploy that trigger as-is. Production trigger authentication, hosted execution, secrets, public publishing and any transaction require their own review. `project.yaml` uses the public Monad testnet RPC.

Official references: [simulation prerequisites](https://docs.chain.link/cre/guides/operations/simulating-workflows), [HTTP client](https://docs.chain.link/cre/reference/sdk/http-client-ts), [EVM client](https://docs.chain.link/cre/reference/sdk/evm-client-ts).

CLI 1.36.0 is recommended by the [official Mac installation documentation](https://docs.chain.link/cre/getting-started/cli-installation/macos-linux) checked October 3. It is not installed on this Mac by this task; personal installation/login remains the minimum user step. No authentication token or persistent credential was created.
