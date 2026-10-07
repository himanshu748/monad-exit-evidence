import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAbiParameters, encodeEventTopics, type Abi } from 'viem';
import abi from '../integrations/envio/abis/Exchange.json' with { type: 'json' };
import { CHAIN_INFO } from '../integrations/envio/src/normalize.ts';
import { createHyperSyncReader, parseHyperSyncPage } from '../src/data/envio-hypersync.ts';
import { getEnvioActivity, getEnvioIndexedTransaction } from '../src/data/envio.ts';

// Deliberate unit inputs, never runtime fallback data or claimed integration evidence.
const clock = Date.parse('2026-10-04T12:00:00Z'), hash = '0x' + 'a'.repeat(64), blockHash = '0x' + 'b'.repeat(64);
const eventAbi = (abi as unknown as Abi).find(item => item.type === 'event' && item.name === 'PositionClosed');
if (!eventAbi || eventAbi.type !== 'event') throw new Error('Official event ABI missing');
function block(number = 119, timestamp = clock / 1000) { return { number, timestamp, hash: blockHash }; }
function log(number = 119) { return { block_number: number, block_hash: blockHash, transaction_hash: hash, log_index: 3,
  address: CHAIN_INFO.mainnet.contract, removed: false,
  data: encodeAbiParameters(eventAbi!.type === 'event' ? eventAbi!.inputs : [], [1n, 9007199254740993n, 0, 7n, -12n, 2n]),
  topic0: encodeEventTopics({ abi: abi as unknown as Abi, eventName: 'PositionClosed' })[0], topic1: null, topic2: null, topic3: null }; }
function page(from = 104, to = 120, number = 119) { return { archive_height: 120, next_block: to, data: { blocks: Array.from({ length: to - from }, (_, i) => block(from + i)), logs: [log(number)] } }; }

test('HyperSync strict decoding preserves complete log and exact ABI integer provenance', () => {
  const parsed = parseHyperSyncPage(page(), 'mainnet', 104, 120), event = parsed.events[0];
  assert.equal(parsed.nextBlock, 120);
  assert.equal(event.source, 'ENVIO');
  assert.equal(event.accountId, '9007199254740993');
  assert.equal(event.quantity, null);
  assert.equal(event.blockHash, blockHash);
  assert.equal(event.id, `143:${hash}:3`);
  assert.match(event.decoded, /"deltaPnlCNS":"-12"/);
  assert.equal(parseHyperSyncPage({ ...page(), data: [page().data] }, 'mainnet', 104, 120).events[0].id, event.id);
});

test('HyperSync rejects wrong exchange, network, block joins, removed logs and invalid ABI bytes', () => {
  for (const changed of [{ address: '0x' + 'c'.repeat(40) }, { block_hash: '0x' + 'c'.repeat(64) }, { block_number: 121 },
    { removed: true }, { data: '0x01' }, { topic0: '0x' + 'c'.repeat(64) }, { topic1: null, topic2: '0x' + 'c'.repeat(64) }, { log_index: 1.5 }]) {
    assert.throws(() => parseHyperSyncPage({ ...page(), data: { blocks: [block()], logs: [{ ...log(), ...changed }] } }, 'mainnet', 104, 120));
  }
  assert.throws(() => parseHyperSyncPage(page(), 'testnet', 104, 120));
  assert.throws(() => parseHyperSyncPage({ ...page(), data: { blocks: [], logs: [log()] } }, 'mainnet', 104, 120));
  assert.throws(() => parseHyperSyncPage({ ...page(), next_block: 104 }, 'mainnet', 104, 120));
  assert.throws(() => parseHyperSyncPage({ ...page(), archive_height: 118 }, 'mainnet', 104, 120));
});

test('HyperSync rejects conflicting duplicates and bounds response row sets', () => {
  const changed = { ...log(), data: encodeAbiParameters(eventAbi!.type === 'event' ? eventAbi!.inputs : [], [1n, 9007199254740993n, 0, 8n, -12n, 2n]) };
  assert.throws(() => parseHyperSyncPage({ ...page(), data: { blocks: [block()], logs: [log(), changed] } }, 'mainnet', 104, 120));
  assert.throws(() => parseHyperSyncPage({ ...page(), data: { blocks: [block(), { ...block(), timestamp: clock / 1000 - 1 }], logs: [] } }, 'mainnet', 104, 120));
  assert.throws(() => parseHyperSyncPage({ ...page(), data: Array(21).fill({ blocks: [], logs: [] }) }, 'mainnet', 104, 120));
  assert.throws(() => parseHyperSyncPage({ ...page(), data: { blocks: [block()], logs: Array(4001).fill(log()) } }, 'mainnet', 104, 120));
  assert.equal(parseHyperSyncPage({ ...page(), data: { blocks: [block()], logs: [log(), log()] } }, 'mainnet', 104, 120).events.length, 1);
});

function transport(handler: (url: string, body: any) => unknown): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => new Response(JSON.stringify(handler(String(input), init?.body ? JSON.parse(String(init.body)) : null)))) as typeof fetch;
}
test('HyperSync completes pagination, pins its origin and preserves cache source timestamps', async () => {
  const requests: { url: string; body: any }[] = [];
  let time = clock;
  const reader = createHyperSyncReader(transport((url, body) => {
    requests.push({ url, body });
    if (url.endsWith('/height')) return { height: 120 };
    if (body.from_block === 119) return { archive_height: 120, next_block: 120, data: { blocks: [block()] } };
    if (body.from_block === 104) return { ...page(104, 112, 110), data: { blocks: page(104, 112, 110).data.blocks, logs: [{ ...log(110), transaction_hash: '0x' + 'e'.repeat(64) }] } };
    return page(112, 120, 119);
  }), () => 'unit-test-only-token', () => time);
  const [first, second] = await Promise.all([reader.activity('mainnet'), reader.activity('mainnet')]);
  assert.strictEqual(first, second);
  assert.equal(requests.length, 3);
  assert.equal(first.engine, 'HYPERSYNC');
  assert.equal(first.watermark, 119);
  assert.equal(first.providerHead, 119);
  assert.equal(first.windowStartBlock, 104);
  assert.equal(first.events.length, 2);
  assert(requests.every(request => request.url.startsWith('https://monad.hypersync.xyz/')));
  assert.equal(requests[1].body.logs[0].address[0], CHAIN_INFO.mainnet.contract);
  time += 29999;
  assert.strictEqual(await reader.activity('mainnet'), first);
  assert.equal(first.receivedAt, new Date(clock).toISOString());
  assert.equal(requests.length, 3);
});

test('HyperSync targeted lookup queries the real selected block, never substitutes receipt values', async () => {
  const ranges: number[] = [];
  const reader = createHyperSyncReader(transport((url, body) => {
    if (url.endsWith('/height')) return { height: 120 };
    ranges.push(body.from_block);
    return body.from_block === 119 ? { archive_height: 120, next_block: 120, data: { blocks: [block()] } } : page(80, 81, 80);
  }), () => 'unit-test-only-token', () => clock);
  const match = await reader.transaction('mainnet', hash, 3, 80);
  assert.deepEqual(ranges, [119, 80]);
  assert.equal(match.watermark, 80);
  assert.equal(match.providerHead, 119);
  assert.equal(match.events[0].blockNumber, 80);
  assert.equal((await reader.transaction('mainnet', '0x' + 'd'.repeat(64), 3, 80)).events.length, 0);
  await assert.rejects(reader.transaction('mainnet', hash, 3, 120), /ahead/);
});

test('HyperSync stale or changing head, incomplete pagination and unavailable access fail closed', async () => {
  for (const reason of ['stale', 'changed', 'incomplete']) {
    const reader = createHyperSyncReader(transport((url, body) => {
      if (url.endsWith('/height')) return { height: 120 };
      if (body.from_block === 119) return { archive_height: 120, next_block: 120, data: { blocks: [block(119, clock / 1000 - (reason === 'stale' ? 301 : 0))] } };
      if (reason === 'changed') return { ...page(), data: { blocks: [{ ...block(), hash: '0x' + 'c'.repeat(64) }], logs: [] } };
      return { archive_height: 120, next_block: body.from_block + 1, data: { blocks: [], logs: [] } };
    }), () => 'unit-test-only-token', () => clock);
    await assert.rejects(reader.activity('mainnet'));
  }
  let called = false;
  const reader = createHyperSyncReader(transport(() => { called = true; return {}; }), () => undefined, () => clock);
  await assert.rejects(reader.activity('mainnet'), /access/);
  assert.equal(called, false);
  const limited = createHyperSyncReader((async () => new Response('provider detail must not leak', { status: 429 })) as typeof fetch, () => 'unit-test-only-token');
  await assert.rejects(limited.activity('mainnet'), /unavailable or rate limited/);
});

test('Explicit HyperSync configuration without access cannot fall back to the running Mac indexer', async () => {
  const previousSource = process.env.ENVIO_DATA_SOURCE, previousToken = process.env.ENVIO_API_TOKEN;
  process.env.ENVIO_DATA_SOURCE = 'hypersync'; delete process.env.ENVIO_API_TOKEN;
  try {
    const activity = await getEnvioActivity('mainnet');
    assert.equal(activity.status, 'unavailable');
    assert.equal(activity.watermark, null);
    assert.deepEqual(activity.events, []);
    assert.match(activity.error!, /HyperSync/);
    assert.equal((await getEnvioIndexedTransaction('mainnet', hash, 3, 80)).status, 'unavailable');
  } finally {
    if (previousSource === undefined) delete process.env.ENVIO_DATA_SOURCE; else process.env.ENVIO_DATA_SOURCE = previousSource;
    if (previousToken === undefined) delete process.env.ENVIO_API_TOKEN; else process.env.ENVIO_API_TOKEN = previousToken;
  }
});

test('HyperSync complete cursors without complete block coverage cannot claim a live window', async () => {
  const reader = createHyperSyncReader(transport((url, body) => {
    if (url.endsWith('/height')) return { height: 120 };
    if (body.from_block === 119) return { archive_height: 120, next_block: 120, data: { blocks: [block()] } };
    return { archive_height: 120, next_block: 120, data: { blocks: [], logs: [] } };
  }), () => 'unit-test-only-token', () => clock);
  await assert.rejects(reader.activity('mainnet'), /coverage incomplete/);
});

test('HyperSync cache expires at the original provider head freshness boundary', async () => {
  let time = clock, requests = 0;
  const timestamp = clock / 1000 - 299;
  const reader = createHyperSyncReader(transport((url, body) => {
    requests++;
    if (url.endsWith('/height')) return { height: 120 };
    if (body.from_block === 119) return { archive_height: 120, next_block: 120, data: { blocks: [block(119, timestamp)] } };
    return { ...page(), data: { blocks: page().data.blocks.map(b => ({ ...b, timestamp })), logs: [log()] } };
  }), () => 'unit-test-only-token', () => time);
  const first = await reader.activity('mainnet');
  assert.equal(first.providerHeadObservedAt, new Date(timestamp * 1000).toISOString());
  time += 1001;
  await assert.rejects(reader.activity('mainnet'), /stale/);
  assert.equal(requests, 4);
});

test('offline provider failures cool down both read paths and diagnostics disclose only fixed reasons/statuses', async () => {
  let time = clock, calls = 0, fail = true;
  const diagnostics: unknown[] = [];
  const reader = createHyperSyncReader((async (input: any, init: any) => {
    calls++;
    if (fail) return new Response('raw-body-secret-marker', { status: 429 });
    const body = init?.body ? JSON.parse(init.body) : undefined;
    return new Response(JSON.stringify(String(input).endsWith('/height') ? { height: 120 } : body.from_block === 119 ? { archive_height: 120, next_block: 120, data: { blocks: [block()] } } : page()));
  }) as typeof fetch, () => 'private-unit-token-marker', () => time, item => diagnostics.push(item));
  await assert.rejects(reader.activity('mainnet'));
  const firstCalls = calls;
  for (let i = 0; i < 20; i++) { await assert.rejects(reader.activity('mainnet')); await assert.rejects(reader.transaction('mainnet', hash, 3, 80)); }
  assert.equal(calls, firstCalls);
  assert.deepEqual(diagnostics, [{ component: 'envio-hypersync', network: 'mainnet', reason: 'http-429', status: 429 }]);
  time += 8000; await assert.rejects(reader.transaction('mainnet', hash, 3, 80));
  assert.equal(calls, firstCalls + 1); assert.equal(diagnostics.length, 1);
  time += 8000; fail = false;
  assert.equal((await reader.activity('mainnet')).status, 'live');
  assert(!JSON.stringify(diagnostics).includes('marker'));
});
test('offline missing/whitespace token, malformed response and stale head diagnostics are coarse and bounded', async () => {
  for (const mode of ['missing', 'whitespace', 'parse', 'stale', 'transport', 'timeout'] as const) {
    const diagnostics: any[] = []; let calls = 0, time = clock;
    const reader = createHyperSyncReader((async (input: any, init: any) => {
      calls++;
      if (mode === 'transport') throw new Error('raw-error-token-url-account-marker');
      if (mode === 'parse') return new Response('raw-invalid-body-marker');
      const body = init?.body ? JSON.parse(init.body) : undefined;
      if (String(input).endsWith('/height')) return new Response(JSON.stringify({ height: 120 }));
      if (body.from_block === 119) return new Response(JSON.stringify({ archive_height: 120, next_block: 120, data: { blocks: [block(119, clock / 1000 - (mode === 'stale' ? 301 : 0))] } }));
      if (mode === 'timeout') time += 20001;
      return new Response(JSON.stringify({ ...page(), data: { blocks: page().data.blocks.map(b => ({ ...b, timestamp: clock / 1000 - (mode === 'stale' ? 301 : 0) })), logs: [log()] } }));
    }) as typeof fetch, () => mode === 'missing' ? undefined : mode === 'whitespace' ? 'private-unit-token\n' : 'private-unit-token', () => time, item => diagnostics.push(item));
    await assert.rejects(reader.activity('mainnet'));
    const expected = { missing: 'token-missing', whitespace: 'token-whitespace', parse: 'parse', stale: 'stale-head', transport: 'transport', timeout: 'timeout' }[mode];
    assert.deepEqual(diagnostics, [{ component: 'envio-hypersync', network: 'mainnet', reason: expected }]);
    if (mode === 'missing' || mode === 'whitespace') assert.equal(calls, 0);
    assert(!JSON.stringify(diagnostics).includes('marker'));
  }
});
test('offline bad parameters and ahead-of-provider targets cannot poison subsequent valid activity', async () => {
  let calls = 0;
  const reader = createHyperSyncReader(transport((url, body) => {
    calls++;
    if (url.endsWith('/height')) return { height: 120 };
    return body.from_block === 119 ? { archive_height: 120, next_block: 120, data: { blocks: [block()] } } : page();
  }), () => 'unit-test-only-token', () => clock, () => {});
  await assert.rejects(reader.transaction('mainnet', 'bad-hash', 3, 80));
  await assert.rejects(reader.transaction('mainnet', hash, -1, 80));
  assert.equal(calls, 0);
  await assert.rejects(reader.transaction('mainnet', hash, 3, 120), /ahead/);
  assert.equal((await reader.activity('mainnet')).status, 'live');
  assert.equal(calls, 4);
});
test('offline concurrent identical targeted reads share bounded upstream work', async () => {
  let calls = 0;
  const reader = createHyperSyncReader(transport((url, body) => {
    calls++;
    if (url.endsWith('/height')) return { height: 120 };
    return body.from_block === 119 ? { archive_height: 120, next_block: 120, data: { blocks: [block()] } } : page(80,81,80);
  }), () => 'unit-test-only-token', () => clock, () => {});
  const result = await Promise.all(Array.from({length:20}, () => reader.transaction('mainnet', hash, 3, 80)));
  assert.equal(calls, 3); assert(result.every(item => item === result[0]));
});

test('offline both-network previews share a conservative provider budget and keep original cache times', async () => {
  let time = clock, calls = 0;
  const reader = createHyperSyncReader(transport((url, body) => {
    calls++;
    if (url.endsWith('/height')) return { height: 120 };
    const network = url.includes('monad-testnet') ? 'testnet' : 'mainnet';
    const response = page(body.from_block, body.to_block, body.to_block - 1);
    return { ...response, data: { blocks: response.data.blocks.map(b => ({ ...b, timestamp: time / 1000 })),
      logs: [{ ...response.data.logs[0], address: CHAIN_INFO[network].contract }] } };
  }), () => 'unit-test-only-token', () => time, () => {});
  const initial = await Promise.all([reader.activity('mainnet'), reader.activity('testnet')]);
  assert.equal(calls, 4);
  time += 29999;
  const cached = await Promise.all([reader.activity('mainnet'), reader.activity('testnet')]);
  assert.strictEqual(cached[0], initial[0]); assert.strictEqual(cached[1], initial[1]);
  assert.equal(cached[0].receivedAt, new Date(clock).toISOString());
  assert.equal(calls, 4);
  time++;
  const refreshed = await Promise.all([reader.activity('mainnet'), reader.activity('testnet')]);
  assert.equal(calls, 8);
  assert.equal(refreshed[0].receivedAt, new Date(time).toISOString());
});

test('offline target lookup pressure cannot consume the reserved preview budget or extend stale cache', async () => {
  let time = clock, calls = 0;
  const reader = createHyperSyncReader(transport((url, body) => {
    calls++;
    if (url.endsWith('/height')) return { height: 120 };
    const network = url.includes('monad-testnet') ? 'testnet' : 'mainnet';
    if (body.from_block === 119) return { archive_height: 120, next_block: 120, data: { blocks: [block(119, time / 1000)] } };
    const response = page(body.from_block, body.to_block, body.to_block - 1);
    return { ...response, data: { blocks: response.data.blocks.map(b => ({ ...b, timestamp: time / 1000 })),
      logs: [{ ...response.data.logs[0], address: CHAIN_INFO[network].contract }] } };
  }), () => 'unit-test-only-token', () => time, () => {});
  await Promise.all([reader.activity('mainnet'), reader.activity('testnet')]);
  await reader.transaction('mainnet', hash, 3, 80);
  await reader.transaction('testnet', hash, 3, 80);
  assert.equal(calls, 10);
  await assert.rejects(reader.transaction('mainnet', hash, 3, 80), /budget/);
  assert.equal(calls, 11);
  time += 30000;
  const fresh = await Promise.all([reader.activity('mainnet'), reader.activity('testnet')]);
  assert.equal(calls, 15);
  assert.equal(fresh[0].receivedAt, new Date(time).toISOString());
  for (let i = 0; i < 10; i++) await assert.rejects(reader.transaction('mainnet', hash, 3, 80), /budget/);
  assert.equal(calls, 15);
  time += 30000;
  await Promise.all([reader.activity('mainnet'), reader.activity('testnet')]);
  assert.equal(calls, 19);
});

test('offline target HTTP400 does not poison a valid activity cache or disclose provider text', async () => {
  let calls = 0;
  const reader = createHyperSyncReader((async (input: any, init: any) => {
    calls++;
    const body = init?.body ? JSON.parse(init.body) : undefined;
    if (String(input).endsWith('/height')) return new Response(JSON.stringify({ height: 120 }));
    if (body.from_block === 80) return new Response('private-offline-error-body', { status: 400 });
    return new Response(JSON.stringify(body.from_block === 119
      ? { archive_height: 120, next_block: 120, data: { blocks: [block()] } } : page()));
  }) as typeof fetch, () => 'unit-test-only-token', () => clock, () => {});
  const activity = await reader.activity('mainnet');
  await assert.rejects(reader.transaction('mainnet', hash, 3, 80), error => error instanceof Error && !error.message.includes('private-offline'));
  assert.strictEqual(await reader.activity('mainnet'), activity);
  assert.equal(calls, 5);
});
