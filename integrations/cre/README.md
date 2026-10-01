# Read-only CRE exit-observation verifier

This is real CRE SDK code, not a mock workflow. It combines `HTTPClient` (Perpl public context) and `EVMClient.getTransactionReceipt` (Monad) to compare a declared scope with independently fetched position-decrease evidence. It supports the official `PositionDecreased` event and returns UNKNOWN/inconclusive for unsupported evidence, including `PositionClosed` without an attributable quantity.

The claim includes the full supported policy preimage (schemaVersion 1, chainId, exchange, accountId, marketId, authorizedCloseQuantity). The verifier recomputes its canonical SHA256 digest and requires all claim fields to match. It also binds transaction identity. It does **not** verify owner signatures, agent attribution or finality. The result is a narrowly named public observation, never proof that this app submitted a trade. Configuration is testnet by default. No wallet key, write capability, `--broadcast` path or signing code exists.

## Verified locally

- `@chainlink/cre-sdk` 1.23.0 pinned in package-lock.json
- TypeScript typecheck passes using the real SDK interfaces
- Five core predicate tests pass, including wrong-chain/contract/transaction, quantity overrun, stale HTTP data, missing evidence and conflicting duplicate log
- Official CRE CLI 1.35.0 was downloaded and its published SHA256 verified
- An actual CLI simulation attempt stopped before execution with `Authentication required: not logged in and no CRE_API_KEY set`

**No successful CRE CLI simulation, WASM build or DON deployment is claimed.** Unit tests and typechecking are not substitutes for the required simulation.

## After user-controlled authentication

1. Install CRE CLI from its [official installation guide](https://docs.chain.link/cre/getting-started/cli-installation).
2. Sign in personally using `cre login`. Do not place credentials in chat or source control.
3. Run `npm ci` in this directory.
4. Prepare a real claim JSON from a supported `PositionDecreased` event on Monad testnet. Quantities are exact integer lot units, not human decimals. Include chainId 10143, exchange, transactionHash, accountId, marketId, authorizedCloseQuantity a policy object with schemaVersion 1, chainId, exchange, accountId, marketId and authorizedCloseQuantity; and the exact 64-character lowercase SHA256 policyDigest of that canonical policy. The exported exitPolicyDigest helper produces this digest.
5. From this directory run `cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0 --http-payload @claim.json`.

The HTTP trigger intentionally permits empty authorization for local simulation. Do not deploy that trigger as-is. Production trigger authentication, hosted execution, secrets, public publishing and any transaction require their own review. `project.yaml` uses the public Monad testnet RPC.

Official references: [simulation prerequisites](https://docs.chain.link/cre/guides/operations/simulating-workflows), [HTTP client](https://docs.chain.link/cre/reference/sdk/http-client-ts), [EVM client](https://docs.chain.link/cre/reference/sdk/evm-client-ts).
