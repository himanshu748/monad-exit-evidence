import { canonical } from "./canonical.ts";
export { canonical } from "./canonical.ts";
import { createHash } from "node:crypto";
import type {
  Receipt,
  ReceiptBody,
  VerificationResult,
  Check,
} from "./types.ts";
import { integer } from "./quantity.ts";
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
        (c) => !c || !["PASS", "FAIL", "UNKNOWN"].includes(c.result),
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
      r.execution.providerWrites === 0;
    checks.push({
      name: "Recorded quantities stay within replay limits",
      result: bounded ? "PASS" : "FAIL",
      expected: "filled + reserved <= approved <= original; real writes = 0",
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
