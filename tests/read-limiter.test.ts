import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import { createApp } from '../src/server.ts';
import { createReadLimiter, readClientIdentity } from '../src/read-limiter.ts';

function request(headers: IncomingMessage['headers'] = {}, peer = '127.0.0.1') {
  return { headers, socket: { remoteAddress: peer } } as Pick<IncomingMessage, 'headers' | 'socket'>;
}
function complete(limiter: ReturnType<typeof createReadLimiter>, identity: string) {
  const result = limiter.admit(identity);
  if (result.allowed) result.release();
  return result;
}
test('standalone identity ignores spoofed forwarded headers; Vercel trust is explicit and narrow', () => {
  const headers = { 'x-vercel-forwarded-for': '192.0.2.1', 'x-forwarded-for': '192.0.2.2', 'x-real-ip': '192.0.2.3', 'cf-connecting-ip': '192.0.2.4' };
  assert.equal(readClientIdentity(request(headers)), 'ip:127.0.0.1');
  assert.equal(readClientIdentity(request(headers), true), 'ip:192.0.2.1');
  assert.equal(readClientIdentity(request({ 'x-forwarded-for': '192.0.2.2' }), true), 'ip:127.0.0.1');
  for (const malformed of ['192.0.2.1, 192.0.2.2', 'not-an-ip', '192.0.2.01', '[::1]:80', 'x'.repeat(1000), ['192.0.2.1', '192.0.2.2']]) {
    assert.equal(readClientIdentity(request({ 'x-vercel-forwarded-for': malformed }), true), 'ip:127.0.0.1');
  }
});
test('equivalent IPv6 and mapped IPv4 identities share a bucket', () => {
  assert.equal(readClientIdentity(request({}, '::ffff:127.0.0.1')), 'ip:127.0.0.1');
  assert.equal(readClientIdentity(request({}, '::ffff:7f00:1')), 'ip:127.0.0.1');
  assert.equal(readClientIdentity(request({ 'x-vercel-forwarded-for': '2001:0DB8:0000:0000:0000:0000:0000:0001' }), true), readClientIdentity(request({ 'x-vercel-forwarded-for': '2001:db8::1' }), true));
});
test('one abusive client is isolated and rejected calls cannot poison the shared allowance', () => {
  const limiter = createReadLimiter();
  for (let i = 0; i < 40; i++) assert.equal(complete(limiter, 'A').allowed, true);
  for (let i = 0; i < 1000; i++) assert.deepEqual(limiter.admit('A'), { allowed: false, retryAfter: 60, reason: 'client-window' });
  assert.equal(limiter.snapshot().admissions, 40);
  for (let i = 0; i < 40; i++) assert.equal(complete(limiter, 'B').allowed, true);
  assert.equal(limiter.snapshot().admissions, 80);
  assert.equal(limiter.snapshot().clients, 2);
});
test('aggregate protection still bounds admitted work across clients', () => {
  const limiter = createReadLimiter();
  for (let i = 0; i < 120; i++) assert.equal(complete(limiter, 'client-' + i).allowed, true);
  const before = limiter.snapshot();
  for (let i = 120; i < 300; i++) assert.deepEqual(limiter.admit('client-' + i), { allowed: false, retryAfter: 60, reason: 'global-window' });
  assert.deepEqual(limiter.snapshot(), before);
});
test('per-client concurrency leaves capacity for others and release is idempotent', () => {
  const limiter = createReadLimiter(), leases = [limiter.admit('A'), limiter.admit('A'), limiter.admit('A'), limiter.admit('A')];
  assert.deepEqual(limiter.admit('A'), { allowed: false, retryAfter: 1, reason: 'client-concurrency' });
  const other = limiter.admit('B');
  assert.equal(other.allowed, true);
  assert.equal(limiter.snapshot().active, 5);
  for (const lease of [...leases, other]) { assert(lease.allowed); lease.release(); lease.release(); }
  assert.equal(limiter.snapshot().active, 0);
  for (let i = 0; i < 6; i++) assert.equal(limiter.admit('concurrent-' + i).allowed, true);
  assert.deepEqual(limiter.admit('C'), { allowed: false, retryAfter: 1, reason: 'global-concurrency' });
});
test('storage is bounded without evicting active clients or resetting their limits', () => {
  let now = 0;
  const limiter = createReadLimiter({ maxClients: 2, global: 10000, perClient: 10000 }, () => now);
  const active = limiter.admit('A'); assert(active.allowed);
  assert(complete(limiter, 'B').allowed);
  for (let i = 0; i < 1000; i++) assert.equal(limiter.admit('new-' + i).allowed, false);
  assert.deepEqual(limiter.snapshot(), { clients: 2, active: 1, admissions: 2 });
  now = 60_000;
  assert(complete(limiter, 'C').allowed); // expired idle B is removed; active A stays tracked
  assert.equal(limiter.snapshot().clients, 2);
  active.release();
  now = 120_000;
  assert(complete(limiter, 'D').allowed);
  assert.equal(limiter.snapshot().clients, 1);
});
test('window rollover permits new work and a backwards clock cannot reset an allowance', () => {
  let now = 1000;
  const limiter = createReadLimiter({ perClient: 1 }, () => now);
  assert(complete(limiter, 'A').allowed);
  now = 0;
  assert.equal(complete(limiter, 'A').allowed, false);
  now = 61_000;
  assert(complete(limiter, 'A').allowed);
});
test('HTTP public listener rejects header-based bypass after client exhaustion', async () => {
  const server = createApp({ publicMode: true });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try {
    for (let i = 0; i < 40; i++) { const r = await fetch(base + '/api/not-found'); assert.equal(r.status, 404); await r.text(); }
    const denied = await fetch(base + '/api/not-found', { headers: { 'x-vercel-forwarded-for': '192.0.2.8', 'x-forwarded-for': '192.0.2.8' } });
    assert.equal(denied.status, 429);
    assert(Number(denied.headers.get('retry-after')) >= 1);
    assert.equal((await denied.json() as any).error.code, 'READ_LIMIT');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('explicit platform-header HTTP adapter keeps two client budgets separate', async () => {
  // Deliberate isolated proxy-boundary test. Only the real deployment adapter
  // enables this option from VERCEL=1; these headers are not integration proof.
  const server = createApp({ publicMode: true, trustVercelProxy: true });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try {
    for (let i = 0; i < 40; i++) { const r = await fetch(base + '/api/not-found', { headers: { 'x-vercel-forwarded-for': '192.0.2.1' } }); assert.equal(r.status, 404); await r.text(); }
    const denied = await fetch(base + '/api/not-found', { headers: { 'x-vercel-forwarded-for': '192.0.2.1' } }); assert.equal(denied.status, 429); await denied.text();
    const other = await fetch(base + '/api/not-found', { headers: { 'x-vercel-forwarded-for': '192.0.2.2' } }); assert.equal(other.status, 404); await other.text();
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('IPv6 privacy addresses share a /64 allowance while different prefixes and mapped IPv4 remain distinct', () => {
  const a = readClientIdentity(request({ 'x-vercel-forwarded-for': '2001:db8:1234:5678::1' }), true);
  const b = readClientIdentity(request({ 'x-vercel-forwarded-for': '2001:db8:1234:5678:ffff:eeee:dddd:cccc' }), true);
  const c = readClientIdentity(request({ 'x-vercel-forwarded-for': '2001:db8:1234:5679::1' }), true);
  assert.equal(a, b); assert.notEqual(a, c);
  const limiter = createReadLimiter({ perClient: 1 });
  assert(complete(limiter, a).allowed); assert.equal(complete(limiter, b).allowed, false); assert(complete(limiter, c).allowed);
  assert.equal(readClientIdentity(request({}, '::ffff:c000:201')), 'ip:192.0.2.1');
});
test('observation concurrency is isolated, denied work is uncharged and ordinary reads retain four slots', () => {
  const limiter = createReadLimiter(), a = limiter.admit('A', 'observation'); assert(a.allowed);
  const before = limiter.snapshot();
  for (let i = 0; i < 1000; i++) assert.deepEqual(limiter.admit('A', 'observation'), { allowed: false, retryAfter: 5, reason: 'client-observation-concurrency' });
  assert.deepEqual(limiter.snapshot(), before);
  const b = limiter.admit('B', 'observation'); assert(b.allowed);
  const after = limiter.snapshot();
  assert.deepEqual(limiter.admit('C', 'observation'), { allowed: false, retryAfter: 5, reason: 'global-observation-concurrency' });
  assert.deepEqual(limiter.snapshot(), after);
  const ordinary = ['C','D','E','F'].map(key => limiter.admit(key));
  assert(ordinary.every(lease => lease.allowed)); assert.equal(limiter.snapshot().active, 6);
  a.release(); a.release();
  const next = limiter.admit('G', 'observation'); assert(next.allowed);
  b.release(); next.release(); for (const lease of ordinary) { assert(lease.allowed); lease.release(); }
  assert.equal(limiter.snapshot().active, 0);
});
test('HTTP observation cap does not block a different client from reading activity', async () => {
  // Offline gated provider dependency, never runtime or integration evidence.
  let finish!: (value: any) => void, calls = 0;
  const server = createApp({ publicMode: true, trustVercelProxy: true,
    observation: async () => { calls++; return await new Promise(resolve => { finish = resolve; }) as any; },
    activity: async () => ({ status: 'unavailable', source: 'ENVIO', chainId: 143, watermark: null, receivedAt: new Date().toISOString(), events: [] }) });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const first = fetch(base + '/api/observations?network=mainnet', { headers: { 'x-vercel-forwarded-for': '192.0.2.1' } });
  try {
    for (let i = 0; i < 50 && !calls; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(calls, 1);
    const denied = await fetch(base + '/api/observations?network=mainnet', { headers: { 'x-vercel-forwarded-for': '192.0.2.1' } });
    assert.equal(denied.status, 429); assert.equal(denied.headers.get('retry-after'), '5'); await denied.text(); assert.equal(calls, 1);
    const ordinary = await fetch(base + '/api/activity?network=mainnet', { headers: { 'x-vercel-forwarded-for': '192.0.2.2' } });
    assert.equal(ordinary.status, 200); await ordinary.text();
  } finally { finish?.({}); await (await first).text(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
