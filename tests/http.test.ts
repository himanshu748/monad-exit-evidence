import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.ts';
import { readFile } from 'node:fs/promises';
async function withApp(run: (base: string) => Promise<void>) {
  const server = createApp();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${(server.address() as { port: number }).port}`); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}
test('runtime rejects simulated execution and legacy receipt routes', async () => withApp(async base => {
  for (const path of ['/api/rehearsals', '/api/receipts/verify']) {
    const response = await fetch(base + path, { method: 'POST' });
    assert.equal(response.status, 410);
    const body = await response.json() as any;
    assert.equal(body.data, null); assert.equal(body.error.code, 'SIMULATION_REMOVED');
  }
}));
test('runtime permits no trading writes or arbitrary upstream URLs', async () => withApp(async base => {
  assert.equal((await fetch(base + '/api/trading/orders', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/api/markets?network=http://evil.invalid')).status, 400);
  assert.equal((await fetch(base + '/api/rehearsals', { method: 'POST', headers: { origin: 'https://evil.invalid' } })).status, 403);
}));
test('malformed transaction identifiers fail before RPC access', async () => withApp(async base => {
  for (const query of ['network=mainnet&transactionHash=bad', 'network=mainnet&transactionHash=bad&logIndex=-1', 'network=other&transactionHash=bad'])
    assert.equal((await fetch(base + '/api/observations?' + query)).status, 400);
}));
test('actual public Perpl market and book routes return real provider provenance', async () => withApp(async base => {
  for (const network of ['mainnet','testnet']) {
    const markets = await (await fetch(base + '/api/markets?network=' + network)).json() as any;
    assert.equal(markets.error, null); assert.ok(markets.data.markets.length > 0);
    assert.equal(markets.data.chainId, network === 'mainnet' ? 143 : 10143);
    assert.equal(markets.data.source, 'PERPL_PUBLIC_API');
    const book = await (await fetch(`${base}/api/book?network=${network}&marketId=${markets.data.markets[0].id}`)).json() as any;
    assert.equal(book.error, null); assert.equal(book.data.source, 'PERPL_PUBLIC_API');
    assert.ok(Array.isArray(book.data.bids)); assert.equal(book.data.estimate, undefined);
  }
}));
test('real public receipt is decoded independently of saved evidence', async () => withApp(async base => {
  const proofs = JSON.parse(await readFile(new URL('../integrations/envio/evidence/receipt-cross-check.json', import.meta.url), 'utf8'));
  for (const proof of proofs) {
    // Only a real historical transaction identifier is read from the proof;
    // all values must be fetched again from public RPC, never returned from this file.
    const response = await fetch(`${base}/api/observations?network=${proof.network}&transactionHash=${proof.transactionHash}&logIndex=${proof.logIndex ?? proof.indexedEvent.logIndex}`);
    const body = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(body.error));
    assert.equal(body.data.observation.source, 'MONAD_PUBLIC_RPC');
    assert.equal(body.data.observation.transactionHash, proof.transactionHash);
    assert.equal(body.data.observation.kind, proof.kind);
    assert.ok(body.data.checks.slice(0,4).every((c: any) => c.result === 'PASS'));
    assert.ok(body.data.integrity.digest);
  }
}));
test('health describes real-only runtime and leaves unconnected integrations gated', async () => withApp(async base => {
  const body = await (await fetch(base + '/api/health')).json() as any;
  assert.equal(body.data.mode, 'LIVE_READ_ONLY'); assert.equal(body.data.simulationEnabled, false);
  assert.equal(body.data.tradingEnabled, false); assert.equal(body.data.integrations.cre, 'omitted-user-choice');
  assert.equal(body.data.integrations.nansen, 'access-required');
}));
