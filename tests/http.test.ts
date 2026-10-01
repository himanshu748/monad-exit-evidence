import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.ts";
import { RehearsalLedger } from "../src/core/ledger.ts";
import { normalizeContext, snapshots } from "../src/data/perpl.ts";
async function setup() {
  const now = Date.now();
  const data = normalizeContext(
    {
      chain: { chain_id: 143 },
      tokens: [{ id: 1, decimals: 6 }],
      instances: [{ id: 1, collateral_token_id: 1 }],
      markets: [
        {
          id: 1,
          instance_id: 1,
          name: "BTC",
          symbol: "BTC",
          config: { price_decimals: 1, size_decimals: 5, is_open: true },
          state: {
            at: { t: now },
            mrk: 830000,
            bid: 829990,
            ask: 830010,
            oi: 100,
            dva: "1000",
          },
          funding: { rate: 0 },
        },
      ],
    },
    "mainnet",
    now,
  );
  snapshots.set(data.snapshotRef, { time: now, data });
  const ledger = new RehearsalLedger(":memory:");
  const server = createApp({ ledger, markets: async () => data });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as { port: number };
  const base = `http://127.0.0.1:${addr.port}`;
  const input = {
    network: "mainnet",
    marketId: 1,
    direction: "long",
    positionQuantity: "0.04",
    closeQuantity: "0.02",
    priceLimit: "83000",
    sizeDecimals: 5,
    priceDecimals: 1,
    scenario: "interrupted",
    snapshotRef: data.snapshotRef,
    snapshotObservedAt: data.observedAt,
  };
  return { server, ledger, base, input };
}
test("HTTP replay is durable idempotent and changed body conflicts", async () => {
  const { server, ledger, base, input } = await setup();
  try {
    const options = (body: unknown) => ({
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "http-request-01",
      },
      body: JSON.stringify(body),
    });
    const a = await fetch(base + "/api/rehearsals", options(input));
    assert.equal(a.status, 200);
    const first = (await a.json()) as any;
    const b = await fetch(base + "/api/rehearsals", options(input));
    assert.deepEqual(((await b.json()) as any).data, first.data);
    assert.equal(first.data.execution.status, "UNKNOWN");
    assert.equal(
      (
        await fetch(
          base + "/api/rehearsals",
          options({ ...input, closeQuantity: "0.01" }),
        )
      ).status,
      409,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    ledger.close();
  }
});
test("HTTP cannot forward arbitrary URLs or mutate provider and rejects bad origin", async () => {
  const { server, ledger, base, input } = await setup();
  try {
    assert.equal(
      (await fetch(base + "/api/trading/orders", { method: "POST" })).status,
      404,
    );
    assert.equal(
      (await fetch(base + "/api/markets?network=http://evil.invalid")).status,
      400,
    );
    const res = await fetch(base + "/api/rehearsals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.invalid",
        "idempotency-key": "http-request-01",
      },
      body: JSON.stringify(input),
    });
    assert.equal(res.status, 403);
    assert.equal((await fetch(base + "/api/health")).status, 200);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    ledger.close();
  }
});
test("HTTP rejects precision changes and unknown snapshot", async () => {
  const { server, ledger, base, input } = await setup();
  try {
    for (const patch of [{ sizeDecimals: 4 }, { snapshotRef: "untrusted" }]) {
      const res = await fetch(base + "/api/rehearsals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "http-request-02",
        },
        body: JSON.stringify({ ...input, ...patch }),
      });
      assert.equal(res.status, 422);
    }
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    ledger.close();
  }
});

test("health reports actual per-network Envio availability", async () => {
  const ledger = new RehearsalLedger(":memory:");
  const server = createApp({
    ledger,
    activity: async (n) => ({
      status: n === "mainnet" ? "live" : "unavailable",
      source: "ENVIO",
      chainId: n === "mainnet" ? 143 : 10143,
      watermark: n === "mainnet" ? 1 : null,
      receivedAt: new Date().toISOString(),
      events: [],
    }),
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const port = (server.address() as any).port;
    const r = await fetch(`http://127.0.0.1:${port}/api/health`);
    const b = (await r.json()) as any;
    assert.equal(b.data.integrations.envio, "live");
    assert.deepEqual(b.data.envioNetworks, {
      mainnet: "live",
      testnet: "unavailable",
    });
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    ledger.close();
  }
});
