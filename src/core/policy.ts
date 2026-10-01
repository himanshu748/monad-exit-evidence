import type { Policy, Action, PolicyContext, Check } from "./types.ts";
import { integer } from "./quantity.ts";
import { digest } from "./receipt.ts";
export function evaluatePolicy(
  policy: Policy,
  action: Action,
  context: PolicyContext,
  expectedDigest: string,
): Check[] {
  const checks: Check[] = [];
  const add = (
    name: string,
    pass: boolean,
    expected: string,
    observed: string,
  ) =>
    checks.push({
      name,
      result: pass ? "PASS" : "FAIL",
      expected,
      observed,
      source: "DETERMINISTIC_POLICY",
    });
  add(
    "Policy binding",
    digest(policy) === expectedDigest,
    expectedDigest,
    digest(policy),
  );
  add(
    "Replay boundary",
    policy.mode === "REPLAY" && policy.schemaVersion === 1,
    "REPLAY schema 1",
    `${policy.mode} schema ${policy.schemaVersion}`,
  );
  add(
    "Network binding",
    action.chainId === policy.chainId &&
      policy.chainId === (policy.network === "mainnet" ? 143 : 10143),
    String(policy.chainId),
    String(action.chainId),
  );
  add(
    "Account binding",
    action.accountId === policy.accountId,
    policy.accountId,
    action.accountId,
  );
  add(
    "Worker binding",
    action.workerId === policy.workerId,
    policy.workerId,
    action.workerId,
  );
  add(
    "Market binding",
    action.marketId === policy.marketId,
    String(policy.marketId),
    String(action.marketId),
  );
  add(
    "Only position reduction",
    action.operation ===
      (policy.direction === "long" ? "CLOSE_LONG" : "CLOSE_SHORT"),
    policy.direction === "long" ? "CLOSE_LONG" : "CLOSE_SHORT",
    action.operation,
  );
  add(
    "Direction unchanged",
    context.currentDirection === policy.direction,
    policy.direction,
    context.currentDirection,
  );
  add(
    "Authorization active",
    context.active && !context.stopped,
    "active and not stopped",
    context.active && !context.stopped ? "active" : "inactive or stopped",
  );
  add(
    "Within request window",
    context.now >= Date.parse(policy.createdAt) &&
      context.now < Date.parse(policy.requestDeadline),
    policy.requestDeadline,
    new Date(context.now).toISOString(),
  );
  try {
    const q = integer(action.quantity),
      f = integer(context.filledQuantity),
      r = integer(context.reservedQuantity),
      a = integer(policy.authorizedCloseQuantity),
      p = integer(context.currentPositionQuantity),
      limit = integer(policy.priceLimit),
      price = integer(action.price);
    add("No unresolved prior request", r === 0n, "0 reserved", r.toString());
    add(
      "Exact approved quantity bound",
      q > 0n && q + f + r <= a && q <= p,
      `positive quantity; cumulative <= ${a}`,
      `${q} + ${f} + ${r}`,
    );
    add(
      "Price limit",
      policy.direction === "long" ? price >= limit : price <= limit,
      `${policy.direction === "long" ? ">=" : "<="} ${limit}`,
      price.toString(),
    );
  } catch (error) {
    add(
      "Integer quantities",
      false,
      "valid bounded integers",
      error instanceof Error ? error.message : "invalid quantity",
    );
  }
  return checks;
}
