import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeNansenBalances,
  evaluateWalletBudget,
  fetchNansenBalances,
  getNansenStatus,
} from "../src/data/nansen.ts";
const wallet = "0x1111111111111111111111111111111111111111",
  token = "0x2222222222222222222222222222222222222222",
  stable = "0x3333333333333333333333333333333333333333";
const now = 1790844800000;
const payload = {
  pagination: { page: 1, per_page: 1000, is_last_page: true },
  data: [
    {
      chain: "monad",
      address: wallet,
      token_address: token,
      token_symbol: "MON",
      value_usd: 800,
    },
    {
      chain: "monad",
      address: wallet,
      token_address: stable,
      token_symbol: "AUSD",
      value_usd: 200,
    },
  ],
};
const limits = {
  wallet,
  chainId: 143,
  targetToken: token,
  maxConcentrationBps: 7000,
  minLiquidBufferUsd: "250",
  liquidTokens: [stable],
};
test("Nansen portfolio data changes budget outcome with transparent contribution", () => {
  const p = normalizeNansenBalances(payload, wallet, now, "FIXTURE");
  const r = evaluateWalletBudget(p, limits, now);
  assert.equal(r.outcome, "OUTSIDE_LIMITS");
  assert.equal(r.targetConcentrationBps, 8000);
  assert.equal(r.liquidBufferUsd, "200");
  assert.equal(r.sourceMode, "FIXTURE");
});
test("Nansen stale and wrong-account contexts fail closed", () => {
  const p = normalizeNansenBalances(payload, wallet, now, "FIXTURE");
  assert.equal(
    evaluateWalletBudget(p, limits, now + 300001).outcome,
    "UNKNOWN",
  );
  assert.equal(
    evaluateWalletBudget(p, { ...limits, wallet: stable }, now).outcome,
    "UNKNOWN",
  );
  assert.equal(
    evaluateWalletBudget(p, { ...limits, chainId: 10143 }, now).outcome,
    "UNKNOWN",
  );
});
test("Nansen partial pages, mixed chain/account and missing valuation are rejected", () => {
  assert.throws(() =>
    normalizeNansenBalances(
      { ...payload, pagination: { is_last_page: false } },
      wallet,
      now,
      "FIXTURE",
    ),
  );
  for (const patch of [
    { chain: "ethereum" },
    { address: stable },
    { value_usd: null },
  ])
    assert.throws(() =>
      normalizeNansenBalances(
        { ...payload, data: [{ ...payload.data[0], ...patch }] },
        wallet,
        now,
        "FIXTURE",
      ),
    );
});
test("Nansen valid user limits produce within-limits status, never trade authorization", () => {
  const p = normalizeNansenBalances(payload, wallet, now, "FIXTURE");
  const r = evaluateWalletBudget(
    p,
    { ...limits, maxConcentrationBps: 9000, minLiquidBufferUsd: "100" },
    now,
  );
  assert.equal(r.outcome, "WITHIN_LIMITS");
  assert.equal(r.authorizesExecution, false);
});
test("no transport means no live request, no automatic payment or fake data", async () => {
  assert.equal(getNansenStatus().status, "access-required");
  await assert.rejects(
    () => fetchNansenBalances(wallet),
    /authorized transport/,
  );
});
test("provider errors propagate unavailable; request uses exact official endpoint", async () => {
  let called = "";
  await assert.rejects(
    () =>
      fetchNansenBalances(wallet, async (url, body) => {
        called = url;
        assert.equal(body.chain, "monad");
        throw new Error("HTTP 429");
      }),
    /429/,
  );
  assert.equal(
    called,
    "https://api.nansen.ai/api/v1/profiler/address/current-balance",
  );
});

test("complete portfolio requires the first and only consistently sized page", () => {
  for (const pagination of [
    { page: 2, per_page: 1000, is_last_page: true },
    { page: 1, per_page: 1, is_last_page: true },
    { page: 1, per_page: 0, is_last_page: true },
    { is_last_page: true },
  ])
    assert.throws(() =>
      normalizeNansenBalances(
        { ...payload, pagination },
        wallet,
        now,
        "FIXTURE",
      ),
    );
  const p = normalizeNansenBalances(payload, wallet, now, "FIXTURE");
  assert.deepEqual(p.completeness, {
    page: 1,
    perPage: 1000,
    isLastPage: true,
    count: 2,
  });
});
