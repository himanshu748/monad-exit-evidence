import { sha256, stringToHex } from "viem";
import { canonical } from "./canonical.ts";
export type ExitPolicy = {
  schemaVersion: number;
  chainId: number;
  exchange: string;
  accountId: string;
  marketId: string;
  authorizedCloseQuantity: string;
};
export function exitPolicyDigest(policy: ExitPolicy): string {
  return sha256(stringToHex(canonical(policy))).slice(2);
}
export type ExitClaim = {
  chainId: number;
  exchange: string;
  transactionHash: string;
  accountId: string;
  marketId: string;
  authorizedCloseQuantity: string;
  policyDigest: string;
  policy: ExitPolicy;
};
export type ExitObservation = {
  chainId: number;
  exchange: string;
  transactionHash: string;
  status: string;
  apiChainId: number;
  apiExchange: string;
  apiMarketId: string;
  apiObservedAt: number;
  observedAt: number;
  decreases: {
    id: string;
    accountId: string;
    marketId: string;
    before: string;
    after: string;
  }[];
};
export function verifyExitObservation(
  claim: ExitClaim,
  observation: ExitObservation,
) {
  const checks: {
    name: string;
    result: "PASS" | "FAIL" | "UNKNOWN";
    detail: string;
  }[] = [];
  const add = (
    name: string,
    result: "PASS" | "FAIL" | "UNKNOWN",
    detail: string,
  ) => checks.push({ name, result, detail });
  let filled = 0n;
  const validClaim =
    [143, 10143].includes(claim.chainId) &&
    /^0x[0-9a-fA-F]{40}$/.test(claim.exchange) &&
    /^0x[0-9a-fA-F]{64}$/.test(claim.transactionHash) &&
    /^[0-9a-f]{64}$/.test(claim.policyDigest) &&
    [claim.accountId, claim.marketId, claim.authorizedCloseQuantity].every(
      (v) => /^(0|[1-9]\d{0,38})$/.test(v),
    ) &&
    BigInt(claim.authorizedCloseQuantity) > 0n;
  let bound = false;
  try {
    const p = claim.policy;
    bound =
      !!p &&
      Object.keys(p).sort().join(",") ===
        "accountId,authorizedCloseQuantity,chainId,exchange,marketId,schemaVersion" &&
      p.schemaVersion === 1 &&
      p.chainId === claim.chainId &&
      typeof p.exchange === "string" &&
      p.exchange.toLowerCase() === claim.exchange.toLowerCase() &&
      p.accountId === claim.accountId &&
      p.marketId === claim.marketId &&
      p.authorizedCloseQuantity === claim.authorizedCloseQuantity &&
      exitPolicyDigest(p) === claim.policyDigest;
  } catch {
    bound = false;
  }
  add(
    "Policy preimage binding",
    bound ? "PASS" : "FAIL",
    "The full supported policy preimage must hash to the supplied digest and match every claimed limit. This is integrity, not owner authentication.",
  );
  add(
    "Declared scope",
    validClaim ? "PASS" : "FAIL",
    "The claim binds policy digest, chain, exchange, transaction, account, market and quantity; it does not authenticate an owner.",
  );
  const chain =
    observation.chainId === claim.chainId &&
    observation.transactionHash.toLowerCase() ===
      claim.transactionHash.toLowerCase() &&
    observation.exchange.toLowerCase() === claim.exchange.toLowerCase();
  add(
    "Chain evidence binding",
    chain ? "PASS" : "FAIL",
    "Observed receipt must match the declared chain, transaction and exchange.",
  );
  const api =
    observation.apiChainId === claim.chainId &&
    observation.apiExchange.toLowerCase() === claim.exchange.toLowerCase() &&
    observation.apiMarketId === claim.marketId;
  add(
    "External API context",
    api ? "PASS" : "FAIL",
    "Perpl public context identifies the same exchange, chain and market.",
  );
  const fresh =
    Number.isSafeInteger(observation.apiObservedAt) &&
    Number.isSafeInteger(observation.observedAt) &&
    observation.observedAt - observation.apiObservedAt <= 120000 &&
    observation.apiObservedAt <= observation.observedAt + 15000;
  add(
    "API freshness",
    fresh ? "PASS" : "UNKNOWN",
    "Current context must be no more than 120 seconds old and not materially future-dated.",
  );
  add(
    "Transaction status",
    observation.status === "success"
      ? "PASS"
      : observation.status === "failed"
        ? "FAIL"
        : "UNKNOWN",
    "Receipt success is required; success alone does not prove a position reduction.",
  );
  const seen = new Map<string, string>();
  let invalid = false;
  for (const e of observation.decreases) {
    const serial = JSON.stringify(e);
    if (seen.has(e.id)) {
      if (seen.get(e.id) !== serial) invalid = true;
      continue;
    }
    seen.set(e.id, serial);
    if (e.accountId !== claim.accountId || e.marketId !== claim.marketId)
      continue;
    try {
      if (!/^\d{1,39}$/.test(e.before) || !/^\d{1,39}$/.test(e.after))
        throw new Error();
      const before = BigInt(e.before),
        after = BigInt(e.after);
      if (after >= before) throw new Error();
      filled += before - after;
    } catch {
      invalid = true;
    }
  }
  const target = validClaim ? BigInt(claim.authorizedCloseQuantity) : 0n;
  add(
    "Attributable position-decrease logs",
    invalid || filled > target
      ? "FAIL"
      : filled === target && filled > 0n
        ? "PASS"
        : "UNKNOWN",
    `${filled} observed base units; target ${target}. Unsupported close-only logs without a quantity remain inconclusive.`,
  );
  return {
    outcome: checks.some((c) => c.result === "FAIL")
      ? ("CONTRADICTED" as const)
      : checks.some((c) => c.result === "UNKNOWN")
        ? ("INCONCLUSIVE" as const)
        : ("VERIFIED_OBSERVATION" as const),
    filledQuantity: filled.toString(),
    policyDigest: claim.policyDigest,
    ownerAuthorizationVerified: false,
    checks,
    limitations: [
      "Verifies named public observations only; owner signature and agent attribution are not established.",
      "Receipt retrieval alone is not a finality proof.",
      "CRE CLI simulation is local; no DON-deployed verification is implied.",
    ],
  };
}
