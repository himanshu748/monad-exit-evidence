import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { CHAIN_INFO } from '../src/normalize.ts';
import { selectRuntime } from './runtime-options.ts';
import { withSupervisor, stopOwnedChild, exitAfterCleanup, publicRpcChildEnvironment } from './supervisor-lifecycle.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
// This dependency otherwise stops PostgreSQL concurrently on signals and forces
// beforeExit status 0. Our supervisor owns these paths and the final exit status.
const exitHook = createRequire(import.meta.url)('async-exit-hook');
for (const event of ['beforeExit', 'SIGINT', 'SIGTERM', 'SIGHUP']) exitHook.unhookEvent(event);
const { recent, runtime, schema } = selectRuntime(process.argv.slice(2));
await mkdir(runtime, { recursive: true });
const configPath = `${runtime}/config.yaml`;
if (existsSync(`${runtime}/stop`)) {
  console.error(`Remove only ${runtime}/stop to resume this window`);
  process.exit(1);
}
if (recent && !existsSync(configPath)) {
  // A separate database preserves the original backfill and resumes this new window.
  const starts = [];
  for (const [network, rpc] of [['mainnet', 'https://rpc.monad.xyz'], ['testnet', 'https://testnet-rpc.monad.xyz']]) {
    const response = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }), signal: AbortSignal.timeout(20_000) });
    const body = await response.json();
    if (!response.ok || body.error || !/^0x[0-9a-f]+$/i.test(body.result)) throw new Error(`Public ${network} RPC head unavailable`);
    const head = Number(BigInt(body.result));
    if (!Number.isSafeInteger(head) || head < 200) throw new Error('Invalid RPC head');
    starts.push({ network, rpc, head, startBlock: head - 200 });
  }
  let index = 0;
  const config = ('schema: ../../schema.graphql\n' + (await readFile('config.yaml', 'utf8')).replace('./abis/', '../../abis/')).replace(/start_block: \d+/g, () => `start_block: ${starts[index++].startBlock}`);
  if (index !== 2) throw new Error('Expected exactly two configured chains');
  await writeFile(`${runtime}/window.json`, JSON.stringify({ createdAt: new Date().toISOString(), starts }, null, 2) + '\n');
  await writeFile(`${configPath}.tmp`, config);
  await rename(`${configPath}.tmp`, configPath);
}
console.log(`Envio runtime ${runtime}; configuration ${recent ? configPath : 'config.yaml'}`);
try {
process.exitCode = await withSupervisor(async lifecycle => {
const requestStop = () => lifecycle.requestStop();
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, requestStop);
lifecycle.own('signal handlers', () => { for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.off(signal, requestStop); });
const pg = new EmbeddedPostgres({ databaseDir: `${root}${runtime}/postgres`, port: 5439,
  user: 'postgres', password: 'local-development-only', persistent: true, createPostgresUser: false,
  // Loopback TCP only. No OS users, privileged daemon, Docker or Unix socket required.
  postgresFlags: ['-h', '127.0.0.1', '-k', ''], onLog: text => process.stdout.write(text), onError: console.error });
if (!existsSync(`${runtime}/postgres/PG_VERSION`)) await pg.initialise();
// stop() only touches this instance's child and is a no-op before it is spawned.
lifecycle.own('PostgreSQL', () => pg.stop());
if (!lifecycle.running) return;
await pg.start();
if (!lifecycle.running) return;
const sql = postgres({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'local-development-only', database: 'postgres', max: 1, connect_timeout: 2 });
lifecycle.own('SQL connection', () => sql.end({ timeout: 3 }));
const output = createWriteStream(`${runtime}/indexer.log`, { flags: 'a' });
output.on('error', () => { if (lifecycle.running) { console.error('Indexer log unavailable'); lifecycle.requestStop(true); } });
lifecycle.own('indexer log', () => new Promise(resolve => output.end(resolve)));
if (!lifecycle.running) return;
const indexer = spawn('./node_modules/.bin/envio', ['start', '--config', recent ? configPath : 'config.yaml'], { env: { ...publicRpcChildEnvironment(process.env),
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${new URL('./loopback-only.mjs', import.meta.url).href}`,
  ENVIO_PG_HOST: '127.0.0.1', ENVIO_PG_PORT: '5439', ENVIO_PG_USER: 'postgres', ENVIO_PG_PASSWORD: 'local-development-only',
  ENVIO_PG_DATABASE: 'postgres', ENVIO_PG_SCHEMA: schema, ENVIO_HASURA: 'false', ENVIO_TUI: 'false', ENVIO_INDEXER_PORT: '9899' }, stdio: ['ignore', 'pipe', 'pipe'] });
lifecycle.own('Envio child', () => stopOwnedChild(indexer));
indexer.stdout.pipe(output, { end: false }); indexer.stderr.pipe(output, { end: false });
indexer.on('error', () => { console.error('Envio child failed to start'); lifecycle.requestStop(true); });
indexer.on('exit', code => {
  if (lifecycle.running) { console.error(`Envio exited unexpectedly (${code}); snapshots will no longer refresh`); lifecycle.requestStop(true); }
});
async function exportSnapshots() {
  if (!lifecycle.running) return;
  const health = await fetch('http://127.0.0.1:9899/healthz', { signal: AbortSignal.timeout(2_000) });
  await health.body?.cancel();
  if (!health.ok) throw new Error('Envio health check failed');
  // Read chain metadata and entities in one read-only MVCC snapshot. Watermark comes from
  // Envio's committed progress, never max(event.blockNumber) or an independent RPC request.
  const snapshots = await sql.begin('isolation level repeatable read read only', async transaction => {
    await transaction`set local statement_timeout = '2000ms'`;
    const result = [];
    for (const [network, info] of Object.entries(CHAIN_INFO)) {
      const chains = await transaction`select * from ${transaction(schema)}.envio_chains where id = ${info.chainId}`;
      const chain = chains[0];
      console.log(`${network}: chain progress ${JSON.stringify(chain, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
      if (!chain || chain.progress_block < 0 || !chain.progress_block_time) continue;
      const events = await transaction`select * from ${transaction(schema)}."ExchangeEvent" where "chainId" = ${info.chainId} order by "blockNumber" desc, "logIndex" desc limit 50`;
      result.push({ network, source: 'ENVIO', chainId: info.chainId, contract: info.contract,
        watermark: chain.progress_block, sourceBlock: chain.source_block, indexWindow: { runtime, startBlock: chain.start_block },
        progressBlockTime: Math.floor(new Date(chain.progress_block_time).getTime() / 1000),
        queriedAt: new Date().toISOString(), events });
    }
    return result;
  });
  for (const snapshot of snapshots) {
    const destination = `.runtime/${snapshot.network}.json`;
    await writeFile(`${destination}.tmp`, JSON.stringify(snapshot, null, 2) + '\n');
    await rename(`${destination}.tmp`, destination);
    console.log(`${snapshot.network}: Envio watermark ${snapshot.watermark}, ${snapshot.events.length} recent indexed events`);
  }
}
async function loop() {
  while (lifecycle.running && !existsSync(`${runtime}/stop`)) {
    try { await exportSnapshots(); } catch (error) { console.log(`Waiting for Envio: ${error.message}`); }
    await lifecycle.wait(5_000);
  }
}
await loop();
}, name => console.error(`Supervisor cleanup failed: ${name}`));
} catch (error) {
  console.error(`Supervisor startup failed: ${error?.message ?? 'unknown local failure'}`);
  process.exitCode = 1;
}
exitAfterCleanup(process.exitCode ?? 0);
