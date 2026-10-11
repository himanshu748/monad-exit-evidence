import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercise the real startup command in an isolated directory with synthetic values.
// The preloader observes configuration before server imports, then exits: no provider calls.
async function startup(envFile?: string, overrides: NodeJS.ProcessEnv = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'exit-evidence-startup-'));
  try {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const [command, ...args] = manifest.scripts.start.split(/\s+/);
    assert.equal(command, 'node');
    await symlink(fileURLToPath(new URL('../src', import.meta.url)), join(directory, 'src'), 'dir');
    if (envFile !== undefined) await writeFile(join(directory, '.env'), envFile);
    const probe = join(directory, 'startup-probe.mjs');
    await writeFile(probe, `console.log(JSON.stringify({source: process.env.ENVIO_DATA_SOURCE ?? null, token: process.env.ENVIO_API_TOKEN ?? null, port: process.env.PORT ?? null})); process.exit(0);`);
    const child = spawnSync(process.execPath, ['--import', probe, ...args], {
      cwd: directory,
      env: { ...overrides },
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout.trim());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('startup loads HyperSync source, token and port from the local .env before server imports', async () => {
  assert.deepEqual(await startup('ENVIO_DATA_SOURCE=hypersync\nENVIO_API_TOKEN=synthetic-local-token\nPORT=4321\n'), {
    source: 'hypersync', token: 'synthetic-local-token', port: '4321',
  });
});

test('startup keeps shell configuration ahead of .env values', async () => {
  assert.deepEqual(await startup('ENVIO_DATA_SOURCE=hypersync\nENVIO_API_TOKEN=synthetic-file-token\nPORT=4321\n', {
    ENVIO_DATA_SOURCE: 'hyperindex', ENVIO_API_TOKEN: 'synthetic-shell-token', PORT: '4322',
  }), { source: 'hyperindex', token: 'synthetic-shell-token', port: '4322' });
});

test('startup permits an unconfigured checkout without a .env file', async () => {
  assert.deepEqual(await startup(), { source: null, token: null, port: null });
});
