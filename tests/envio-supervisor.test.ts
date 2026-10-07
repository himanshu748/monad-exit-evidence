import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { SupervisorLifecycle, stopOwnedChild, withSupervisor, publicRpcChildEnvironment } from '../integrations/envio/scripts/supervisor-lifecycle.ts';

test('Offline supervisor releases an actual owned child after later startup failure', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  await once(child, 'spawn');
  await assert.rejects(withSupervisor(async lifecycle => {
    lifecycle.own('test child', () => stopOwnedChild(child));
    throw new Error('Later startup failure');
  }), /Later startup failure/);
  assert.ok(child.exitCode !== null || child.signalCode !== null);
});

test('Offline supervisor cleanup is once-only, reverse ordered and continues after a failure', async () => {
  const calls: string[] = [], failures: string[] = [];
  const lifecycle = new SupervisorLifecycle(name => failures.push(name), 100);
  lifecycle.own('database', () => { calls.push('database'); });
  lifecycle.own('connection', () => { calls.push('connection'); throw new Error('Close failed'); });
  lifecycle.own('indexer', () => { calls.push('indexer'); });
  await Promise.all([lifecycle.close(), lifecycle.close()]);
  assert.deepEqual(calls, ['indexer', 'connection', 'database']);
  assert.deepEqual(failures, ['connection']);
  assert.equal(lifecycle.exitCode, 1);
});

test('Offline unexpected child failure preserves nonzero exit status through shutdown', async () => {
  const code = await withSupervisor(async lifecycle => {
    lifecycle.requestStop(true);
    lifecycle.requestStop();
    await lifecycle.wait(30_000);
  });
  assert.equal(code, 1);
});

test('Offline graceful stop interrupts the export wait and returns success', async () => {
  const lifecycle = new SupervisorLifecycle();
  const waiting = lifecycle.wait(30_000);
  lifecycle.requestStop();
  await waiting;
  await lifecycle.close();
  assert.equal(lifecycle.exitCode, 0);
});

test('Offline cleanup deadlines allow remaining resources to close', async () => {
  let databaseClosed = false;
  const lifecycle = new SupervisorLifecycle(() => {}, 10);
  lifecycle.own('database', () => { databaseClosed = true; });
  lifecycle.own('hung cleanup', () => new Promise(() => {}));
  await lifecycle.close();
  assert.equal(databaseClosed, true);
  assert.equal(lifecycle.exitCode, 1);
});

test('Offline owned child that ignores SIGTERM is stopped within a bounded grace period', async () => {
  const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); process.stdout.write("ready\\n"); setInterval(() => {}, 1000)'], { stdio: ['ignore', 'pipe', 'ignore'] });
  await once(child.stdout!, 'data');
  await stopOwnedChild(child, 250);
  assert.equal(child.signalCode, 'SIGKILL');
});

test('Offline supervisor rejects new ownership after cleanup has started', async () => {
  const lifecycle = new SupervisorLifecycle();
  await lifecycle.close();
  assert.throws(() => lifecycle.own('too late', () => {}), /already started/);
});

test('Offline public-RPC child environment excludes HyperSync credentials without mutating the operator environment', () => {
  const environment = { PATH: '/unit/bin', ENVIO_API_TOKEN: 'offline-not-a-credential' };
  assert.deepEqual(publicRpcChildEnvironment(environment), { PATH: '/unit/bin' });
  assert.equal(environment.ENVIO_API_TOKEN, 'offline-not-a-credential');
});

test('Offline final exit deadline ends an actual process with a retained event-loop handle', async () => {
  const module = new URL('../integrations/envio/scripts/supervisor-lifecycle.ts', import.meta.url).href;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    `import { exitAfterCleanup } from ${JSON.stringify(module)}; setInterval(() => {}, 1000); exitAfterCleanup(1, 250);`], { stdio: 'ignore' });
  const [code] = await once(child, 'close');
  assert.equal(code, 1);
});

test('Offline embedded-postgres exit hook must not override the supervisor failure status', async () => {
  const postgresModule = new URL('../integrations/envio/node_modules/embedded-postgres/dist/index.js', import.meta.url).href;
  const hookModule = new URL('../integrations/envio/node_modules/async-exit-hook/index.js', import.meta.url).href;
  const child = spawn(process.execPath, ['--input-type=module', '-e',
    `import ${JSON.stringify(postgresModule)}; import hook from ${JSON.stringify(hookModule)}; hook.unhookEvent('beforeExit'); process.exitCode = 1;`], { stdio: 'ignore' });
  const [code] = await once(child, 'close');
  assert.equal(code, 1);
});

test('Offline owned child shutdown waits for its stdout stream to close', async () => {
  const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => { process.stdout.write("last log\\n", () => process.exit(0)); }); process.stdout.write("ready\\n"); setInterval(() => {}, 1000)'], { stdio: ['ignore', 'pipe', 'ignore'] });
  await once(child.stdout!, 'data');
  let tail = '';
  child.stdout!.on('data', chunk => { tail += chunk; });
  await stopOwnedChild(child);
  assert.equal(child.stdout!.closed, true);
  assert.match(tail, /last log/);
});
