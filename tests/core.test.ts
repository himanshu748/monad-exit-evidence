import test from "node:test";
import assert from "node:assert/strict";
import { parseUnits, formatUnits } from "../src/core/quantity.ts";
import { runRehearsal } from "../src/core/rehearsal.ts";
import { verifyReceipt, sealReceipt } from "../src/core/receipt.ts";
import type { RehearsalInput } from "../src/core/types.ts";
const now = 1790844800000;
const input: RehearsalInput = {
  network: "mainnet",
  marketId: 1,
  direction: "long",
  positionQuantity: "0.04",
  closeQuantity: "0.02",
  priceLimit: "83000.0",
  sizeDecimals: 5,
  priceDecimals: 1,
  scenario: "valid",
};
test("exact decimal amounts never pass through floating point", () => {
  assert.equal(parseUnits("0.04", 5), 4000n);
  assert.equal(parseUnits("0.02", 5), 2000n);
  assert.equal(formatUnits(2000n, 5), "0.02");
});
for (const value of [
  "1e-3",
  "-1",
  "0.000001",
  "NaN",
  "Infinity",
  " 1",
  "1.",
  "01.2",
])
  test(`rejects malformed exact quantity ${value}`, () =>
    assert.throws(() => parseUnits(value, 5)));
test("valid close preserves fixed quantity and zero real provider writes", () => {
  const r = runRehearsal(input, now);
  assert.equal(r.execution.status, "COMPLETED");
  assert.equal(r.authorization.authorizedCloseQuantity, "2000");
  assert.equal(r.execution.filledQuantity, "2000");
  assert.equal(r.execution.remainingPositionQuantity, "2000");
  assert.equal(r.execution.providerWrites, 0);
  assert.equal(verifyReceipt(r).valid, true);
});
test("unauthorized open is rejected before simulated submission", () => {
  const r = runRehearsal({ ...input, scenario: "unauthorized" }, now);
  assert.equal(r.execution.status, "REJECTED");
  assert.equal(r.execution.simulatedSubmissions, 0);
  assert.equal(r.execution.filledQuantity, "0");
});
test("partial IOC ends partial without retry or held remainder", () => {
  const r = runRehearsal({ ...input, scenario: "partial" }, now);
  assert.equal(r.execution.status, "PARTIAL");
  assert.equal(r.execution.filledQuantity, "1200");
  assert.equal(r.execution.reservedQuantity, "0");
  assert.equal(r.execution.simulatedSubmissions, 1);
});
test("unknown submission retains allowance and does not retry", () => {
  const r = runRehearsal({ ...input, scenario: "interrupted" }, now);
  assert.equal(r.execution.status, "UNKNOWN");
  assert.equal(r.execution.reservedQuantity, "2000");
  assert.equal(r.execution.filledQuantity, "0");
  assert.equal(r.execution.simulatedSubmissions, 1);
  assert.ok(r.checks.some((c) => c.result === "UNKNOWN"));
});
test("duplicate observation counts exactly one fill and submission", () => {
  const r = runRehearsal({ ...input, scenario: "duplicate" }, now);
  assert.equal(r.execution.filledQuantity, "2000");
  assert.equal(r.execution.simulatedSubmissions, 1);
});
test("editing receipt outcome or policy fails integrity", () => {
  const r = runRehearsal(input, now);
  assert.equal(
    verifyReceipt({
      ...r,
      execution: { ...r.execution, filledQuantity: "2001" },
    }).valid,
    false,
  );
  assert.equal(
    verifyReceipt({ ...r, authorization: { ...r.authorization, marketId: 20 } })
      .valid,
    false,
  );
});
test("tampered scenario is explicitly detected", () =>
  assert.equal(
    verifyReceipt(runRehearsal({ ...input, scenario: "tampered" }, now)).valid,
    false,
  ));
test("close above original position is rejected", () =>
  assert.throws(() => runRehearsal({ ...input, closeQuantity: "0.05" }, now)));
test("invalid chain input and precision is rejected", () => {
  assert.throws(() => runRehearsal({ ...input, network: "other" } as any, now));
  assert.throws(() => runRehearsal({ ...input, sizeDecimals: 25 }, now));
});

import { evaluatePolicy } from "../src/core/policy.ts";
test("direct worker call cannot change account, market, chain, operation or policy", () => {
  const r = runRehearsal(input, now);
  const p = r.authorization;
  const action = {
    operation: "CLOSE_LONG",
    chainId: p.chainId,
    accountId: p.accountId,
    workerId: p.workerId,
    marketId: p.marketId,
    quantity: "2000",
    price: p.priceLimit,
  };
  const context = {
    now,
    filledQuantity: "0",
    reservedQuantity: "0",
    currentPositionQuantity: "4000",
    currentDirection: "long" as const,
    active: true,
    stopped: false,
  };
  for (const patch of [
    { accountId: "other" },
    { marketId: 20 },
    { chainId: 10143 },
    { workerId: "other" },
    { operation: "OPEN_LONG" },
    { quantity: "2001" },
  ])
    assert.ok(
      evaluatePolicy(
        p,
        { ...action, ...patch },
        context,
        r.authorizationDigest,
      ).some((c) => c.result === "FAIL"),
    );
  assert.ok(
    evaluatePolicy(
      { ...p, marketId: 20 },
      action,
      context,
      r.authorizationDigest,
    ).some((c) => c.name === "Policy binding" && c.result === "FAIL"),
  );
});
test("reserved, expired, revoked and stopped permissions deny new dispatch", () => {
  const r = runRehearsal(input, now);
  const p = r.authorization;
  const action = {
    operation: "CLOSE_LONG",
    chainId: p.chainId,
    accountId: p.accountId,
    workerId: p.workerId,
    marketId: p.marketId,
    quantity: "2000",
    price: p.priceLimit,
  };
  const context = {
    now,
    filledQuantity: "0",
    reservedQuantity: "0",
    currentPositionQuantity: "4000",
    currentDirection: "long" as const,
    active: true,
    stopped: false,
  };
  for (const patch of [
    { reservedQuantity: "2000" },
    { now: now + 60000 },
    { active: false },
    { stopped: true },
    { currentDirection: "short" as const },
  ])
    assert.ok(
      evaluatePolicy(
        p,
        action,
        { ...context, ...patch },
        r.authorizationDigest,
      ).some((c) => c.result === "FAIL"),
    );
});

test("missing required predicates is structural failure even if digest is recomputed", () => {
  const receipt = runRehearsal(input, now);
  const { integrity, ...body } = receipt;
  assert.equal(
    verifyReceipt(sealReceipt({ ...body, checks: [] })).valid,
    false,
  );
});
