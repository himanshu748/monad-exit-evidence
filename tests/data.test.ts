import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeContext,
  estimateDepth,
  normalizeBook,
} from "../src/data/perpl.ts";
const now = 1790844800000;
const context = {
  chain: { chain_id: 143 },
  tokens: [{ id: 1, decimals: 6 }],
  instances: [{ id: 1, collateral_token_id: 1 }],
  markets: [
    {
      id: 1,
      instance_id: 1,
      name: "BTC",
      symbol: "BTC",
      size_units: "BTC",
      config: { price_decimals: 1, size_decimals: 5, is_open: true },
      state: {
        at: { t: now, b: 10 },
        mrk: 830000,
        bid: 829990,
        ask: 830010,
        oi: 1000,
        dva: "100000000",
      },
      funding: { rate: 20 },
    },
  ],
};
test("context converts live precision and marks source without fixture fallback", () => {
  const r = normalizeContext(context, "mainnet", now);
  assert.equal(r.chainId, 143);
  assert.equal(r.markets[0].markPrice, "83000");
  assert.equal(r.markets[0].sizeDecimals, 5);
  assert.equal(r.markets[0].fundingRate, "0.002");
  assert.equal(r.stale, false);
});
test("context fails on wrong chain, absent precision and unsafe integer", () => {
  assert.throws(() => normalizeContext(context, "testnet", now));
  assert.throws(() =>
    normalizeContext(
      {
        ...context,
        markets: [{ ...context.markets[0], config: { is_open: true } }],
      },
      "mainnet",
      now,
    ),
  );
  assert.throws(() =>
    normalizeContext(
      {
        ...context,
        markets: [
          {
            ...context.markets[0],
            state: { ...context.markets[0].state, mrk: 9007199254740992 },
          },
        ],
      },
      "mainnet",
      now,
    ),
  );
});
test("stale market is visible", () =>
  assert.equal(normalizeContext(context, "mainnet", now + 120001).stale, true));
test("book bounds validate sorting and unsafe quantities", () => {
  assert.throws(() =>
    normalizeBook(
      {
        mt: 15,
        at: { t: now },
        bid: [
          { p: 100, s: 1 },
          { p: 101, s: 1 },
        ],
        ask: [],
      },
      1,
      5,
    ),
  );
  assert.throws(() =>
    normalizeBook(
      { mt: 15, at: { t: now }, bid: [{ p: 100, s: NaN }], ask: [] },
      1,
      5,
    ),
  );
});
test("long exit uses bid depth and correctly identifies finite snapshot shortfall", () => {
  const r = estimateDepth(
    [
      { p: 830000n, s: 1000n },
      { p: 829000n, s: 500n },
    ],
    2000n,
    5,
    1,
  );
  assert.equal(r.estimatedFilledQuantity, "0.015");
  assert.equal(r.estimatedAveragePrice, "82966.6");
  assert.equal(r.depthLimited, true);
  assert.equal(r.worstPrice, "82900");
});
test("empty book means unknown quote, not zero price or executable fill", () => {
  const r = estimateDepth([], 1000n, 5, 1);
  assert.equal(r.estimatedAveragePrice, null);
  assert.equal(r.estimatedFilledQuantity, "0");
  assert.equal(r.depthLimited, true);
});

test("collateral scale follows market-instance-token binding", () => {
  const c = {
    ...context,
    tokens: [{ id: 1, decimals: 18 }],
    markets: [
      {
        ...context.markets[0],
        state: { ...context.markets[0].state, dva: "1000000000000000000" },
      },
    ],
  };
  assert.equal(normalizeContext(c, "mainnet", now).markets[0].dailyVolume, "1");
  assert.throws(() =>
    normalizeContext(
      { ...c, instances: [{ id: 1, collateral_token_id: 999 }] },
      "mainnet",
      now,
    ),
  );
});
