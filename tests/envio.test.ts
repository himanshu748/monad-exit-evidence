import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExchangeEvent } from "../integrations/envio/src/normalize.ts";
import { getEnvioActivity, parseEnvioSnapshot } from "../src/data/envio.ts";

const contract = "0x34b6552d57a35a1d042ccae1951bd1c370112a6f";
const hash = "0x" + "a".repeat(64);
const now = Date.parse("2026-10-01T12:00:00Z");
function raw(overrides: Record<string, unknown> = {}) {
  return {
    chainId: 143,
    srcAddress: contract,
    eventName: "MakerOrderFilledV2",
    transaction: { hash },
    block: { number: 100, hash: "0x" + "b".repeat(64), timestamp: now / 1000 },
    logIndex: 3,
    params: {
      perpId: 1n,
      accountId: 99n,
      lotLNS: 9007199254740993n,
      amountCNS: -12n,
    },
    ...overrides,
  };
}
function snapshot(events: unknown[] = [normalizeExchangeEvent(raw())]) {
  return {
    source: "ENVIO",
    chainId: 143,
    contract,
    watermark: 110,
    sourceBlock: 112,
    progressBlockTime: now / 1000,
    queriedAt: new Date(now).toISOString(),
    events,
  };
}
test("Envio normalization preserves exact quantities and chain/contract/log provenance", () => {
  const item = normalizeExchangeEvent(raw());
  assert.equal(item.id, `143:${hash}:3`);
  assert.equal(item.quantity, "9007199254740993");
  assert.equal(
    item.decoded,
    '{"accountId":"99","amountCNS":"-12","lotLNS":"9007199254740993","perpId":"1"}',
  );
  assert.equal(item.contract, contract);
  assert.equal(item.marketId, "1");
  assert.equal(item.source, "ENVIO");
  assert.equal(item.outcome, "OBSERVED_EVENT");
});
test("Envio rejects malformed event provenance and lossy numbers", () => {
  for (const override of [
    { chainId: 1 },
    { srcAddress: "0x" + "f".repeat(40) },
    { transaction: { hash: "wrong" } },
    { logIndex: -1 },
    { params: { lotLNS: 9007199254740992 } },
    { eventName: "UnapprovedEvent" },
  ]) {
    assert.throws(() => normalizeExchangeEvent(raw(override)));
  }
});
test("Envio taker fills never invent a market/account absent from their ABI", () => {
  const item = normalizeExchangeEvent(
    raw({ eventName: "TakerOrderFilledV2", params: { lotLNS: 20n } }),
  );
  assert.equal(item.marketId, null);
  assert.equal(item.accountId, null);
});
test("Envio projection dedupes exact log IDs and sorts deterministically", () => {
  const first = normalizeExchangeEvent(raw());
  const second = normalizeExchangeEvent(raw({ logIndex: 4 }));
  const result = parseEnvioSnapshot(
    snapshot([first, second, first]),
    "mainnet",
    now,
  );
  assert.equal(result.status, "live");
  assert.deepEqual(
    result.events.map((e) => e.logIndex),
    [4, 3],
  );
  assert.equal(result.watermark, 110);
});
test("Envio conflicting duplicate logs, wrong network, and event beyond watermark fail closed", () => {
  const item = normalizeExchangeEvent(raw());
  assert.throws(() =>
    parseEnvioSnapshot(
      snapshot([item, { ...item, quantity: "5" }]),
      "mainnet",
      now,
    ),
  );
  assert.throws(() => parseEnvioSnapshot(snapshot(), "testnet", now));
  assert.throws(() =>
    parseEnvioSnapshot({ ...snapshot(), watermark: 99 }, "mainnet", now),
  );
});
test("Envio empty verified index is live, but stale or unindexed data is unavailable", () => {
  assert.equal(parseEnvioSnapshot(snapshot([]), "mainnet", now).status, "live");
  assert.throws(() =>
    parseEnvioSnapshot({ ...snapshot(), watermark: null }, "mainnet", now),
  );
  assert.throws(() => parseEnvioSnapshot(snapshot(), "mainnet", now + 120_001));
  assert.throws(() =>
    parseEnvioSnapshot(
      { ...snapshot(), progressBlockTime: now / 1000 - 301 },
      "mainnet",
      now,
    ),
  );
});
test("Missing Envio service returns explicit unavailable with no fabricated events", async () => {
  const result = await getEnvioActivity(
    "testnet",
    async () => {
      throw new Error("ECONNREFUSED");
    },
    now,
  );
  assert.equal(result.status, "unavailable");
  assert.equal(result.source, "ENVIO");
  assert.equal(result.chainId, 10143);
  assert.equal(result.watermark, null);
  assert.deepEqual(result.events, []);
  assert.match(result.error!, /unavailable/i);
});
test("Envio adapter reads the actual fresh local read model", async () => {
  const result = await getEnvioActivity(
    "mainnet",
    async () => JSON.stringify(snapshot()),
    now,
  );
  assert.equal(result.status, "live");
  assert.equal(result.events[0].transactionHash, hash);
});
test("Envio fill event must have a quantity and maker account/market", () => {
  assert.throws(() =>
    normalizeExchangeEvent(raw({ params: { perpId: 1n, accountId: 99n } })),
  );
  assert.throws(() => normalizeExchangeEvent(raw({ params: { lotLNS: 20n } })));
});
test("Envio position decrease uses exact lot difference and closed quantity stays unknown", () => {
  const decrease = normalizeExchangeEvent(
    raw({
      eventName: "PositionDecreased",
      params: {
        perpId: 1n,
        accountId: 99n,
        startLotLNS: 9007199254740999n,
        endLotLNS: 2n,
      },
    }),
  );
  assert.equal(decrease.quantity, "9007199254740997");
  assert.throws(() =>
    normalizeExchangeEvent(
      raw({
        eventName: "PositionDecreased",
        params: { perpId: 1n, accountId: 99n, startLotLNS: 1n, endLotLNS: 2n },
      }),
    ),
  );
  assert.equal(
    normalizeExchangeEvent(
      raw({
        eventName: "PositionClosed",
        params: { perpId: 1n, accountId: 99n },
      }),
    ).quantity,
    null,
  );
});
test("Envio projection rejects corrupted normalized quantities and mismatched block provenance", () => {
  const item = normalizeExchangeEvent(raw());
  assert.throws(() =>
    parseEnvioSnapshot(snapshot([{ ...item, quantity: "17" }]), "mainnet", now),
  );
  assert.throws(() =>
    parseEnvioSnapshot(
      snapshot([item, { ...item, blockHash: "0x" + "c".repeat(64) }]),
      "mainnet",
      now,
    ),
  );
});
test("Envio adapter is pinned to network-specific local files and bad data is unavailable", async () => {
  let location = "";
  const result = await getEnvioActivity(
    "mainnet",
    async (path) => {
      location = path.href;
      return JSON.stringify(snapshot());
    },
    now,
  );
  assert.equal(result.status, "live");
  assert.match(location, /\/integrations\/envio\/\.runtime\/mainnet\.json$/);
  for (const content of [
    "not json",
    JSON.stringify({ source: "RPC" }),
    JSON.stringify({
      ...snapshot(),
      queriedAt: new Date(now - 120_001).toISOString(),
    }),
  ]) {
    assert.equal(
      (await getEnvioActivity("mainnet", async () => content, now)).status,
      "unavailable",
    );
  }
});
test("Envio and independent ABI decoders canonicalize safe small integer types identically", () => {
  const native = normalizeExchangeEvent(
    raw({ params: { perpId: 1n, accountId: 99n, lotLNS: 20n, orderType: 4n } }),
  );
  const independent = normalizeExchangeEvent(
    raw({ params: { perpId: 1n, accountId: 99n, lotLNS: 20n, orderType: 4 } }),
  );
  assert.equal(native.decoded, independent.decoded);
});
