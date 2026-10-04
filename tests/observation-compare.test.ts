import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sameIndexedObservation, compareIndexedObservation } from '../src/data/observations.ts';
const proofs = JSON.parse(await readFile(new URL('../integrations/envio/evidence/receipt-cross-check.json', import.meta.url), 'utf8'));
test('source comparison preserves full real indexed provenance and ABI values', () => {
  const event = proofs[0].indexedEvent;
  assert.equal(sameIndexedObservation(event, { ...event }), true);
  for (const changed of [
    { blockHash: event.transactionHash },
    { observedAt: 'changed' },
    { decoded: event.decoded + ' ' },
    { contract: proofs[1].indexedEvent.contract },
    { chainId: proofs[1].chainId },
  ]) assert.equal(sameIndexedObservation(event, { ...event, ...changed }), false);
});

test('offline exact-block HyperSync omission is a failed source comparison, preserving HyperIndex window semantics', () => {
  const observed = proofs[0].indexedEvent;
  const indexed = { status: 'live' as const, source: 'ENVIO' as const, chainId: observed.chainId,
    engine: 'HYPERSYNC' as const, watermark: observed.blockNumber, windowStartBlock: observed.blockNumber,
    providerHead: observed.blockNumber + 20, receivedAt: new Date().toISOString(), events: [] };
  assert.deepEqual(compareIndexedObservation(indexed, observed), { indexStatus: 'MISSING_IN_INDEX', outcome: 'SOURCE_MISMATCH', result: 'FAIL' });
  assert.deepEqual(compareIndexedObservation({ ...indexed, engine: 'HYPERINDEX' }, observed), { indexStatus: 'NOT_IN_CURRENT_PAGE', outcome: 'CHAIN_OBSERVED', result: 'UNKNOWN' });
  assert.deepEqual(compareIndexedObservation({ ...indexed, status: 'unavailable' }, observed), { indexStatus: 'UNAVAILABLE', outcome: 'CHAIN_OBSERVED', result: 'UNKNOWN' });
  assert.equal(compareIndexedObservation({ ...indexed, events: [observed] }, observed).indexStatus, 'MATCH');
  assert.equal(compareIndexedObservation({ ...indexed, events: [{ ...observed, blockHash: observed.transactionHash }] }, observed).indexStatus, 'MISMATCH');
});
