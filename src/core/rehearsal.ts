import type {
  RehearsalInput,
  Receipt,
  Policy,
  ReceiptBody,
  Action,
} from "./types.ts";
import { parseUnits, precision } from "./quantity.ts";
import { digest, sealReceipt } from "./receipt.ts";
import { evaluatePolicy } from "./policy.ts";
const scenarios = [
  "valid",
  "unauthorized",
  "partial",
  "interrupted",
  "duplicate",
  "tampered",
];
export function validateInput(input: RehearsalInput): void {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected a rehearsal object");
  const allowed = new Set([
    "network",
    "marketId",
    "direction",
    "positionQuantity",
    "closeQuantity",
    "priceLimit",
    "sizeDecimals",
    "priceDecimals",
    "scenario",
    "snapshotRef",
    "snapshotObservedAt",
  ]);
  if (Object.keys(input).some((k) => !allowed.has(k)))
    throw new Error("Unexpected rehearsal field");
  if (
    !["mainnet", "testnet"].includes(input.network) ||
    !["long", "short"].includes(input.direction) ||
    !scenarios.includes(input.scenario)
  )
    throw new Error("Unsupported network, direction or scenario");
  if (!Number.isSafeInteger(input.marketId) || input.marketId <= 0)
    throw new Error("Invalid market");
  precision(input.sizeDecimals);
  precision(input.priceDecimals);
  if (
    input.snapshotRef !== undefined &&
    (typeof input.snapshotRef !== "string" || input.snapshotRef.length > 200)
  )
    throw new Error("Invalid snapshot reference");
  if (
    input.snapshotObservedAt !== undefined &&
    !Number.isFinite(Date.parse(input.snapshotObservedAt))
  )
    throw new Error("Invalid snapshot timestamp");
}
export function runRehearsal(input: RehearsalInput, now: number): Receipt {
  validateInput(input);
  const position = parseUnits(input.positionQuantity, input.sizeDecimals),
    target = parseUnits(input.closeQuantity, input.sizeDecimals),
    price = parseUnits(input.priceLimit, input.priceDecimals);
  if (position === 0n || target === 0n || target > position || price === 0n)
    throw new Error(
      "Close quantity and price must be positive, and close must not exceed the hypothetical position",
    );
  const policy: Policy = {
    schemaVersion: 1,
    mode: "REPLAY",
    network: input.network,
    chainId: input.network === "mainnet" ? 143 : 10143,
    accountId: "hypothetical-account",
    workerId: "rehearsal-worker",
    marketId: input.marketId,
    direction: input.direction,
    positionQuantity: position.toString(),
    authorizedCloseQuantity: target.toString(),
    priceLimit: price.toString(),
    createdAt: new Date(now).toISOString(),
    requestDeadline: new Date(now + 60000).toISOString(),
    maxAttempts: 1,
    sizeDecimals: input.sizeDecimals,
    priceDecimals: input.priceDecimals,
    snapshotRef: input.snapshotRef ?? "DETERMINISTIC_FIXTURE",
    snapshotObservedAt: input.snapshotObservedAt ?? new Date(now).toISOString(),
  };
  const authorizationDigest = digest(policy),
    id = digest({ input, now }).slice(0, 24);
  const action: Action = {
    operation:
      input.scenario === "unauthorized"
        ? "OPEN_LONG"
        : input.direction === "long"
          ? "CLOSE_LONG"
          : "CLOSE_SHORT",
    chainId: policy.chainId,
    accountId: policy.accountId,
    workerId: policy.workerId,
    marketId: policy.marketId,
    quantity: target.toString(),
    price: price.toString(),
  };
  const checks = evaluatePolicy(
    policy,
    action,
    {
      now,
      filledQuantity: "0",
      reservedQuantity: "0",
      currentPositionQuantity: position.toString(),
      currentDirection: input.direction,
      active: true,
      stopped: false,
    },
    authorizationDigest,
  );
  let status: ReceiptBody["execution"]["status"] = "COMPLETED";
  let filled = target,
    reserved = 0n,
    submissions = 1;
  if (checks.some((c) => c.result === "FAIL")) {
    status = "REJECTED";
    filled = 0n;
    submissions = 0;
  } else if (input.scenario === "partial") {
    status = "PARTIAL";
    filled = (target * 3n) / 5n;
  } else if (input.scenario === "interrupted") {
    status = "UNKNOWN";
    filled = 0n;
    reserved = target;
  }
  const observedFills = new Map<string, bigint>();
  if (filled > 0n) {
    observedFills.set("fixture-fill-1", filled);
    if (input.scenario === "duplicate")
      observedFills.set("fixture-fill-1", filled);
  }
  filled = [...observedFills.values()].reduce((a, b) => a + b, 0n);
  checks.push({
    name: "Attributable replay fill",
    result:
      status === "UNKNOWN"
        ? "UNKNOWN"
        : status === "REJECTED"
          ? "FAIL"
          : "PASS",
    expected: target.toString(),
    observed: filled.toString(),
    source: "SIMULATED_PROVIDER",
  });
  checks.push({
    name: "Full target observed",
    result:
      status === "UNKNOWN" ? "UNKNOWN" : filled === target ? "PASS" : "FAIL",
    expected: target.toString(),
    observed: filled.toString(),
    source: "SIMULATED_PROVIDER",
  });
  const body: ReceiptBody = {
    schemaVersion: 1,
    id,
    mode: "REPLAY",
    createdAt: policy.createdAt,
    scenario: input.scenario,
    authorization: policy,
    authorizationDigest,
    execution: {
      id: `execution-${id}`,
      status,
      attemptedOperation: action.operation,
      providerWrites: 0,
      simulatedSubmissions: submissions,
      filledQuantity: filled.toString(),
      reservedQuantity: reserved.toString(),
      remainingPositionQuantity: (position - filled).toString(),
      timeline: [
        {
          title: "Limits reviewed",
          detail:
            "Hypothetical position; no owner signature or financial authorization",
          state: "complete",
        },
        {
          title: status === "REJECTED" ? "Action blocked" : "Policy checked",
          detail:
            status === "REJECTED"
              ? "Opening a position is outside the reviewed scope"
              : "Deterministic checks passed within this rehearsal",
          state: status === "REJECTED" ? "blocked" : "complete",
        },
        {
          title:
            status === "UNKNOWN"
              ? "Outcome unresolved"
              : status === "PARTIAL"
                ? "Partial result observed"
                : status === "REJECTED"
                  ? "No request submitted"
                  : "Replay result reconciled",
          detail:
            status === "UNKNOWN"
              ? "Reservation retained. No new request will be made."
              : status === "PARTIAL"
                ? "One IOC attempt ended. The remainder is not retried."
                : input.scenario === "duplicate"
                  ? "Repeated fill identity counted once."
                  : "No real provider write occurred.",
          state:
            status === "UNKNOWN"
              ? "pending"
              : status === "REJECTED"
                ? "blocked"
                : "complete",
        },
      ],
    },
    checks,
    limitations: [
      "This is a deterministic rehearsal using hypothetical positions and simulated execution.",
      "The receipt digest checks integrity; it does not authenticate an owner or prove a real trade.",
      "Live market liquidity is an observation, not a fill-price guarantee.",
      "Reducing a position may realize losses or remove a hedge; no overall risk reduction is promised.",
    ],
  };
  const receipt = sealReceipt(body);
  if (input.scenario === "tampered")
    receipt.execution.filledQuantity = (filled + 1n).toString();
  return receipt;
}
