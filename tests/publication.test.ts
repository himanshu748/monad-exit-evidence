import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.ts';
import { snapshotOrigin } from '../src/data/envio.ts';
import { boundedText } from '../src/data/http.ts';
test('deployment snapshot origin cannot target local/arbitrary hosts or redirects', () => {
  for (const value of ['http://example.trycloudflare.com', 'https://127.0.0.1', 'https://evil.invalid', 'https://u:p@example.trycloudflare.com', 'https://example.trycloudflare.com:444', 'https://example.trycloudflare.com/path', 'https://example.trycloudflare.com/?secret=x']) assert.throws(() => snapshotOrigin(value));
  assert.equal(snapshotOrigin('https://real-indexer-bridge.trycloudflare.com'), 'https://real-indexer-bridge.trycloudflare.com');
});
test('response byte bound cancels a streaming body before buffering its remaining chunks', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(16)); }, cancel() { cancelled = true; } });
  await assert.rejects(boundedText(new Response(stream), 20), /too large/);
  assert.equal(cancelled, true);
  assert.equal(await boundedText(new Response('actual UTF8 bytes'), 32), 'actual UTF8 bytes');
});
test('public API capacity is bounded and raw snapshot bridge is disabled by default', async () => {
  const server = createApp({ publicMode: true });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const first = await fetch(base + '/api/indexer-snapshot?network=mainnet');
    assert.equal(first.status, 404);
    assert.equal(first.headers.get('referrer-policy'), 'no-referrer');
    for (let i = 0; i < 39; i++) { const r = await fetch(base + '/api/not-found'); assert.equal(r.status, 404); await r.text(); }
    const limited = await fetch(base + '/api/health');
    assert.equal(limited.status, 429); assert(Number(limited.headers.get('retry-after')) >= 1 && Number(limited.headers.get('retry-after')) <= 60);
    assert.equal((await limited.json() as any).error.code, 'READ_LIMIT');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('isolated bridge cannot serve frontend, provider proxy or general health routes', async () => {
  const server = createApp({ publicMode: true, bridgeOnly: true });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try {
    for (const path of ['/', '/api/health', '/api/markets?network=mainnet', '/api/observations', '/api/nansen/status']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 404);
      assert.equal((await response.json() as any).error.code, 'NOT_FOUND');
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
