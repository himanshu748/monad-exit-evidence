import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRuntime } from '../integrations/envio/scripts/runtime-options.ts';
test('Envio named windows preserve standard/recent runtimes and bind schema to a safe tag', () => {
  assert.equal(selectRuntime([]).runtime, '.runtime');
  assert.equal(selectRuntime(['--recent']).runtime, '.runtime/recent');
  assert.deepEqual(selectRuntime(['--recent','--window','oct04-live']), { recent: true, runtime: '.runtime/recent-oct04-live', schema: 'mandate_envio_recent_oct04_live' });
});
test('Envio window arguments cannot traverse paths, inject schemas or silently reset defaults', () => {
  for (const args of [['--window','oct04'], ['--recent','--window'], ['--recent','--window','../recent'], ['--recent','--window','x;drop'], ['--recent','--window','a_b'], ['--recent','--window','a'.repeat(33)], ['--recent','--recent'], ['--recent','--window','a','--window','b']])
    assert.throws(() => selectRuntime(args));
});
