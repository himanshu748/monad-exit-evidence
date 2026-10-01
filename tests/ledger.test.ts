import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RehearsalLedger } from "../src/core/ledger.ts";
import type { RehearsalInput } from "../src/core/types.ts";
const input: RehearsalInput = {
  network: "testnet",
  marketId: 16,
  direction: "long",
  positionQuantity: "0.04",
  closeQuantity: "0.02",
  priceLimit: "83000",
  sizeDecimals: 5,
  priceDecimals: 1,
  scenario: "interrupted",
};
test("idempotency survives close and restart with unknown reservation unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "mandate-ledger-"));
  try {
    let l = new RehearsalLedger(join(dir, "test.sqlite"));
    const first = l.run("request-0001", input, 1790844800000);
    const again = l.run("request-0001", input, 1790844801000);
    assert.deepEqual(again, first);
    l.close();
    l = new RehearsalLedger(join(dir, "test.sqlite"));
    assert.deepEqual(l.run("request-0001", input), first);
    assert.equal(first.execution.reservedQuantity, "2000");
    l.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("same idempotency key with changed amount is conflict and creates no replacement", () => {
  const l = new RehearsalLedger(":memory:");
  const first = l.run("request-0001", input);
  assert.throws(
    () => l.run("request-0001", { ...input, closeQuantity: "0.01" }),
    /Idempotency/,
  );
  assert.deepEqual(l.run("request-0001", input), first);
  l.close();
});
