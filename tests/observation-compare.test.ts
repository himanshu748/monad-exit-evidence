import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sameIndexedObservation } from '../src/data/observations.ts';
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
