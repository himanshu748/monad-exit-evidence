# Useful onchain component proposal — not deployed

The current workbench reads public contracts and rehearses outcomes locally. It has no application-owned onchain mechanism or financial settlement. A Monad testnet deployment is permitted by the portal, but this build has not made one. Do not represent a hosted reader or another protocol's contract as this app's deployment.

Possible narrow extension: ExitEvidenceRegistry, an append-only owner-address/nonce-bound commitment to a complete policy and observation receipt. Store sender, policy digest, canonical observation digest, referenced chain and transaction, nonce and block time. Reject zero digests and duplicate owner/nonce pairs; emit EvidenceAnchored. No custody, trade calls, delegated spending or administrator rewrite. UI compares exported JSON with the anchored record and Envio indexes the event for another party to retrieve.

This proves only which address committed bytes at a recorded block. It does not prove a Perpl account owner, a fill, truthful observations, prior authorization or settlement. A decorative hash store is insufficient to certify an Onchain Finance entry; confirm organizers' actual mechanism/settlement interpretation before adding it. An authenticated policy registration/revocation or real exit mechanism would be a materially larger scope.

Minimum later steps: approve the useful component/track fit, implement and locally test contract plus UI/indexer round-trip, independently review the source, then let the user personally deploy/sign with a testnet wallet and record the genuine contract address and receipt. No wallet creation, faucet request, signing or transaction occurred in this task. This is a reviewable design proposal, not a deployment approval request or eligibility guarantee.
