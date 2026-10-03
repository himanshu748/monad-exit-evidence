import { canonical } from "./canonical.ts";
export { canonical } from "./canonical.ts";
import { createHash } from "node:crypto";
import type {
  Receipt,
  ReceiptBody,
  VerificationResult,
  Check,
} from "./types.ts";
import { integer, precision } from "./quantity.ts";
export function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
const meaning =
  "Integrity checks only: this digest does not authenticate an owner or prove real financial execution.";
export function sealReceipt(body: ReceiptBody): Receipt {
  return {
    ...body,
    integrity: { algorithm: "SHA-256", digest: digest(body), meaning },
  };
}
export function verifyReceipt(value: unknown): VerificationResult {
  const checks: Check[] = [];
  try {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Receipt must be an object");
    const r = value as Receipt;
    const { integrity, ...body } = r;
    if (
      !integrity ||
      integrity.algorithm !== "SHA-256" ||
      typeof integrity.digest !== "string" ||
      !r.authorization ||
      !r.execution ||
      !Array.isArray(r.checks) ||
      r.mode !== "REPLAY" ||
      r.schemaVersion !== 1
    )
      throw new Error("Unsupported receipt shape or mode");
    const text = (v: unknown) => typeof v === "string" && v.length > 0;
    const date = (v: unknown) =>
      text(v) && Number.isFinite(Date.parse(v as string));
    const policy = r.authorization,
      execution = r.execution;
    if (
      !text(r.id) ||
      !date(r.createdAt) ||
      ![
        "valid",
        "unauthorized",
        "partial",
        "interrupted",
        "duplicate",
        "tampered",
      ].includes(r.scenario) ||
      !/^[a-f0-9]{64}$/.test(r.authorizationDigest ?? "") ||
      !/^[a-f0-9]{64}$/.test(integrity.digest) ||
      !text(integrity.meaning) ||
      policy.schemaVersion !== 1 ||
      policy.mode !== "REPLAY" ||
      !["mainnet", "testnet"].includes(policy.network) ||
      policy.chainId !== (policy.network === "mainnet" ? 143 : 10143) ||
      !text(policy.accountId) ||
      !text(policy.workerId) ||
      !Number.isSafeInteger(policy.marketId) ||
      policy.marketId <= 0 ||
      !["long", "short"].includes(policy.direction) ||
      policy.maxAttempts !== 1 ||
      !date(policy.createdAt) ||
      !date(policy.requestDeadline) ||
      Date.parse(policy.requestDeadline) <= Date.parse(policy.createdAt) ||
      !text(policy.snapshotRef) ||
      !date(policy.snapshotObservedAt) ||
      !text(execution.id) ||
      !text(execution.attemptedOperation) ||
      !Number.isSafeInteger(execution.simulatedSubmissions) ||
      execution.simulatedSubmissions < 0 ||
      execution.simulatedSubmissions > policy.maxAttempts ||
      !Array.isArray(execution.timeline) ||
      execution.timeline.length === 0 ||
      execution.timeline.some(
        (event) =>
          !event ||
          !text(event.title) ||
          !text(event.detail) ||
          !["complete", "blocked", "pending"].includes(event.state),
      ) ||
      !Array.isArray(r.limitations) ||
      r.limitations.length === 0 ||
      r.limitations.some((v) => !text(v))
    )
      throw new Error("Incomplete receipt metadata, policy or execution");
    precision(policy.sizeDecimals);
    precision(policy.priceDecimals);
    if (integer(policy.priceLimit) <= 0n)
      throw new Error("Invalid policy price limit");
    const required = [
      "Policy binding",
      "Replay boundary",
      "Network binding",
      "Account binding",
      "Worker binding",
      "Market binding",
      "Only position reduction",
      "Direction unchanged",
      "Authorization active",
      "Within request window",
      "No unresolved prior request",
      "Exact approved quantity bound",
      "Price limit",
      "Attributable replay fill",
      "Full target observed",
    ];
    if (
      !required.every(
        (name) => r.checks.filter((c) => c?.name === name).length === 1,
      ) ||
      r.checks.some(
        (c) =>
          !c ||
          !text(c.name) ||
          !text(c.expected) ||
          !text(c.observed) ||
          !text(c.source) ||
          !["PASS", "FAIL", "UNKNOWN"].includes(c.result),
      ) ||
      !["COMPLETED", "REJECTED", "PARTIAL", "UNKNOWN"].includes(
        r.execution.status,
      )
    )
      throw new Error("Missing or invalid mandatory receipt predicates");
    const match = digest(body) === integrity.digest;
    checks.push({
      name: "Receipt bytes match digest",
      result: match ? "PASS" : "FAIL",
      expected: integrity.digest,
      observed: digest(body),
      source: "LOCAL_SHA256",
    });
    const policyMatch = digest(r.authorization) === r.authorizationDigest;
    checks.push({
      name: "Policy is bound to receipt",
      result: policyMatch ? "PASS" : "FAIL",
      expected: r.authorizationDigest,
      observed: digest(r.authorization),
      source: "LOCAL_SHA256",
    });
    const filled = integer(r.execution.filledQuantity),
      reserved = integer(r.execution.reservedQuantity),
      authorized = integer(r.authorization.authorizedCloseQuantity),
      position = integer(r.authorization.positionQuantity);
    const bounded =
      filled + reserved <= authorized &&
      authorized <= position &&
      authorized > 0n &&
      position > 0n &&
      integer(r.execution.remainingPositionQuantity) + filled === position &&
      r.execution.providerWrites === 0;
    checks.push({
      name: "Recorded quantities stay within replay limits",
      result: bounded ? "PASS" : "FAIL",
      expected:
        "filled + reserved <= approved <= original; remaining + filled = original; real writes = 0",
      observed: `${filled} + ${reserved} <= ${authorized} <= ${position}`,
      source: "REPLAY_RECORD",
    });
    return { valid: checks.every((c) => c.result === "PASS"), checks, meaning };
  } catch (error) {
    return {
      valid: false,
      checks: [
        ...checks,
        {
          name: "Receipt shape",
          result: "FAIL",
          expected: "Supported complete replay receipt",
          observed: error instanceof Error ? error.message : "Invalid receipt",
          source: "LOCAL_VALIDATION",
        },
      ],
      meaning,
    };
  }
}
