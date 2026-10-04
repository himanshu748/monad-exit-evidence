import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical } from '../src/core/canonical.ts';
import { CHAIN_INFO, type Network } from '../integrations/envio/src/normalize.ts';

const { checkActivity, checkObservation, waitForHistoricalWindow, discoverActivity, writePublicProof, validateEvidenceDirectory, main } = await import(new URL('../scripts/verify-mac-independent.mjs', import.meta.url).href);

// Deliberate offline verifier inputs. No provider is contacted, no runtime data
// is supplied, and passing these checks is not live integration evidence.
const clock = Date.parse('2026-10-04T12:00:00Z');
const timestamp = new Date(clock).toISOString(), hash = '0x' + 'a'.repeat(64);
function event(network: Network = 'mainnet') {
  const { chainId, contract } = CHAIN_INFO[network];
  return { id: `${chainId}:${hash}:3`, chainId, contract, transactionHash: hash,
    blockNumber: 119, blockHash: '0x' + 'b'.repeat(64), logIndex: 3,
    source: 'ENVIO', kind: 'PositionClosed', accountId: '7', marketId: '1', quantity: null,
    observedAt: timestamp, outcome: 'OBSERVED_EVENT', decoded: '{"A":"1","a":"2"}' };
}
function activity(network: Network = 'mainnet', advanced = true) {
  return { status: 'live', source: 'ENVIO', chainId: CHAIN_INFO[network].chainId,
    engine: 'HYPERSYNC', sourceUrl: `https://${network === 'mainnet' ? 'monad' : 'monad-testnet'}.hypersync.xyz`,
    watermark: advanced ? 140 : 119, providerHead: advanced ? 140 : 119,
    windowStartBlock: advanced ? 125 : 104, receivedAt: timestamp, providerHeadObservedAt: timestamp,
    events: advanced ? [] : [event(network)] };
}
function sign(body: any) {
  const { integrity: _unused, ...unsigned } = body;
  return { ...unsigned, integrity: { algorithm: 'SHA-256', digest: createHash('sha256').update(canonical(unsigned)).digest('hex') } };
}
function observation(network: Network = 'mainnet') {
  const selected = event(network);
  return sign({ schema: 'exit-evidence-observation/v1', network, chainId: CHAIN_INFO[network].chainId,
    sourceUrl: network === 'mainnet' ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz',
    verifiedAt: timestamp, outcome: 'INDEX_AND_CHAIN_MATCH',
    observation: { ...selected, source: 'MONAD_PUBLIC_RPC', decoded: JSON.parse(selected.decoded) },
    envio: { status: 'MATCH', engine: 'HYPERSYNC', sourceUrl: activity(network).sourceUrl,
      checkedAt: timestamp, providerHeadObservedAt: timestamp, providerHead: 141,
      windowStartBlock: selected.blockNumber, watermark: selected.blockNumber } });
}

test('offline verifier accepts correctly bound historical evidence and canonical digest on both networks', () => {
  for (const network of ['mainnet', 'testnet'] as const) {
    checkActivity(activity(network), network, clock);
    checkObservation(observation(network), network, event(network), activity(network), clock);
  }
});

test('offline verifier rejects mainnet evidence presented as testnet and incorrect source attribution', () => {
  assert.throws(() => checkActivity(activity('mainnet'), 'testnet', clock), /unavailable/);
  assert.throws(() => checkObservation(observation('mainnet'), 'testnet', event('testnet'), activity('testnet'), clock), /comparison failed/);
  for (const change of [{ chainId: 10143 }, { source: 'MONAD_PUBLIC_RPC' }, { sourceUrl: 'https://example.com' }, { engine: 'HYPERINDEX' }]) {
    assert.throws(() => checkActivity({ ...activity(), ...change }, 'mainnet', clock), /unavailable/);
  }
  for (const change of [{ network: 'testnet' }, { chainId: 10143 }, { sourceUrl: 'https://testnet-rpc.monad.xyz' }]) {
    assert.throws(() => checkObservation(sign({ ...observation(), ...change }), 'mainnet', event(), activity(), clock), /comparison failed/);
  }
  for (const change of [{ engine: 'HYPERINDEX' }, { status: 'UNAVAILABLE' }, { sourceUrl: activity('testnet').sourceUrl }]) {
    assert.throws(() => checkObservation(sign({ ...observation(), envio: { ...observation().envio, ...change } }), 'mainnet', event(), activity(), clock), /comparison failed/);
  }
});

test('offline verifier rejects missing, stale and future final observation timestamps even with a valid digest', () => {
  for (const [field, age] of [['verifiedAt', 120001], ['checkedAt', 120001], ['providerHeadObservedAt', 300001], ['checkedAt', -30001], ['checkedAt', NaN]] as const) {
    const changed = observation();
    const value = Number.isNaN(age) ? 'invalid' : new Date(clock - age).toISOString();
    if (field === 'verifiedAt') changed.verifiedAt = value;
    else changed.envio[field] = value;
    assert.throws(() => checkObservation(sign(changed), 'mainnet', event(), activity(), clock), /timestamps/);
  }
  assert.throws(() => checkActivity({ ...activity(), providerHeadObservedAt: new Date(clock - 300001).toISOString() }, 'mainnet', clock), /timestamps/);
});

test('offline verifier requires exact historical coverage, advancing head and unchanged selected event', () => {
  for (const change of [{ windowStartBlock: 104 }, { watermark: 140 }, { providerHead: 139 }, { providerHead: null }]) {
    assert.throws(() => checkObservation(sign({ ...observation(), envio: { ...observation().envio, ...change } }), 'mainnet', event(), activity(), clock));
  }
  assert.throws(() => checkObservation(observation(), 'mainnet', event(), activity('mainnet', false), clock), /not proven/);
  for (const change of [{ blockHash: '0x' + 'c'.repeat(64) }, { decoded: { A: 'different' } }, { chainId: 10143 }, { logIndex: 4 }]) {
    assert.throws(() => checkObservation(sign({ ...observation(), observation: { ...observation().observation, ...change } }), 'mainnet', event(), activity(), clock));
  }
  assert.throws(() => checkObservation({ ...observation(), verifiedAt: new Date(clock + 1).toISOString() }, 'mainnet', event(), activity(), clock), /digest mismatch/);
});

test('offline verifier waits for provider-reported window advancement instead of a fixed delay', async () => {
  let time = clock, reads = 0;
  const advanced = await waitForHistoricalWindow('mainnet', event(), {
    now: () => time,
    wait: async (ms: number) => { time += ms; },
    readActivity: async (path: string, timeout: number) => {
      assert.equal(path, '/api/activity?network=mainnet');
      assert(timeout > 0 && timeout <= 60000);
      const value = activity('mainnet', ++reads === 3);
      return { ...value, receivedAt: new Date(time).toISOString(), providerHeadObservedAt: new Date(time).toISOString() };
    },
  });
  assert.equal(reads, 3);
  assert.equal(time - clock, 33000);
  assert(advanced.windowStartBlock > event().blockNumber);
});

test('offline verifier fails after a bounded three-minute wait when the preview never advances', async () => {
  let time = clock, reads = 0;
  await assert.rejects(waitForHistoricalWindow('mainnet', event(), {
    now: () => time,
    wait: async (ms: number) => { time += ms; },
    readActivity: async () => {
      reads++;
      return { ...activity('mainnet', false), receivedAt: new Date(time).toISOString(), providerHeadObservedAt: new Date(time).toISOString() };
    },
  }), /within three minutes/);
  assert.equal(time - clock, 180000);
  assert.equal(reads, 16);
});

test('offline event discovery tolerates empty finite previews and fails at a bounded deadline', async () => {
  let time = clock, reads = 0;
  const found = await discoverActivity('mainnet', { now: () => time, wait: async (ms: number) => { time += ms; },
    readActivity: async () => ({ ...activity('mainnet', false), events: ++reads === 3 ? [event()] : [], receivedAt: new Date(time).toISOString(), providerHeadObservedAt: new Date(time).toISOString() }) });
  assert.equal(reads, 3); assert.equal(time-clock, 22000); assert.equal(found.events[0].id, event().id);
  time = clock; reads = 0;
  await assert.rejects(discoverActivity('mainnet', { now: () => time, wait: async (ms: number) => { time += ms; },
    readActivity: async () => { reads++; return { ...activity('mainnet', false), events: [], receivedAt: new Date(time).toISOString(), providerHeadObservedAt: new Date(time).toISOString() }; } }), /Inconclusive:.*within three minutes/);
  assert.equal(time-clock, 180000); assert.equal(reads, 17);
});
test('offline proof-writer regression uses distinct exclusive timestamped files, never overwriting an earlier run', async () => {
  // Temporary OFFLINE input only; removed after the test and never integration proof.
  const directory = await mkdtemp(join(tmpdir(), 'offline-verifier-writer-'));
  try {
    const input = { checkedAt: timestamp, offlineTestOnly: true };
    const first = await writePublicProof(input, directory), before = await readFile(first, 'utf8');
    const second = await writePublicProof({ ...input, secondRun: true }, directory);
    assert.notEqual(first, second); assert.match(first, /2026-10-04T12-00-00-000Z/);
    assert.equal(await readFile(first, 'utf8'), before);
    assert.equal(JSON.parse(await readFile(second, 'utf8')).secondRun, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('offline evidence-directory preflight rejects missing, non-directory and unwritable targets before any provider reads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'offline-verifier-preflight-'));
  const file = join(directory, 'offline-input.txt');
  await writeFile(file, 'offline input');
  const originalFetch = globalThis.fetch, originalDirectory = process.env.EVIDENCE_DIR;
  let reads = 0;
  globalThis.fetch = async () => { reads++; throw new Error('Unexpected offline provider read'); };
  try {
    assert.equal(await validateEvidenceDirectory(directory), directory);
    for (const target of ['', '  ', join(directory, 'missing'), file]) {
      process.env.EVIDENCE_DIR = target;
      await assert.rejects(main());
    }
    // Root can bypass mode permissions; the actual Mac execution user cannot.
    if (process.getuid?.() !== 0) {
      await chmod(directory, 0o500);
      process.env.EVIDENCE_DIR = directory;
      await assert.rejects(main(), { code: 'EACCES' });
    }
    assert.equal(reads, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDirectory === undefined) delete process.env.EVIDENCE_DIR;
    else process.env.EVIDENCE_DIR = originalDirectory;
    await chmod(directory, 0o700);
    await rm(directory, { recursive: true, force: true });
  }
});
test('offline discovery rejects unavailable, wrong-source and incomplete coverage immediately without waiting or proof', async () => {
  for (const changed of [{ status: 'unavailable' }, { sourceUrl: 'https://example.com' }, { watermark: 118 }]) {
    let reads = 0, waits = 0;
    await assert.rejects(discoverActivity('mainnet', { now: () => clock,
      readActivity: async () => { reads++; return { ...activity('mainnet', false), ...changed }; },
      wait: async () => { waits++; } }));
    assert.equal(reads, 1); assert.equal(waits, 0);
  }
});
