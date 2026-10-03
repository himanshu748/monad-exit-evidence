import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { CHAIN_INFO } from '../src/normalize.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const recent = process.argv.includes('--recent');
const runtime = recent ? '.runtime/recent' : '.runtime';
const schema = recent ? 'mandate_envio_recent' : 'mandate_envio';
await mkdir(runtime, { recursive: true });
const configPath = `${runtime}/config.yaml`;
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
const pg = new EmbeddedPostgres({ databaseDir: `${root}${runtime}/postgres`, port: 5439,
  user: 'postgres', password: 'local-development-only', persistent: true, createPostgresUser: false,
  // Loopback TCP only. No OS users, privileged daemon, Docker or Unix socket required.
  postgresFlags: ['-h', '127.0.0.1', '-k', ''], onLog: text => process.stdout.write(text), onError: console.error });
if (!existsSync(`${runtime}/postgres/PG_VERSION`)) await pg.initialise();
await pg.start();
const sql = postgres({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'local-development-only', database: 'postgres', max: 1 });
const output = createWriteStream(`${runtime}/indexer.log`, { flags: 'a' });
const indexer = spawn('./node_modules/.bin/envio', ['start', '--config', recent ? configPath : 'config.yaml'], { env: { ...process.env,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${new URL('./loopback-only.mjs', import.meta.url).href}`,
  ENVIO_PG_HOST: '127.0.0.1', ENVIO_PG_PORT: '5439', ENVIO_PG_USER: 'postgres', ENVIO_PG_PASSWORD: 'local-development-only',
  ENVIO_PG_DATABASE: 'postgres', ENVIO_PG_SCHEMA: schema, ENVIO_HASURA: 'false', ENVIO_TUI: 'false', ENVIO_INDEXER_PORT: '9899' }, stdio: ['ignore', 'pipe', 'pipe'] });
indexer.stdout.pipe(output); indexer.stderr.pipe(output);
let running = true;
indexer.on('exit', code => { console.error(`Envio exited (${code}); snapshots will no longer refresh`); running = false; });
async function exportSnapshots() {
  if (!running) return;
  const health = await fetch('http://127.0.0.1:9899/healthz', { signal: AbortSignal.timeout(2_000) });
  if (!health.ok) throw new Error('Envio health check failed');
  // Read chain metadata and entities in one read-only MVCC snapshot. Watermark comes from
  // Envio's committed progress, never max(event.blockNumber) or an independent RPC request.
  const snapshots = await sql.begin('isolation level repeatable read read only', async transaction => {
    const result = [];
    for (const [network, info] of Object.entries(CHAIN_INFO)) {
      const chains = await transaction`select * from ${transaction(schema)}.envio_chains where id = ${info.chainId}`;
      const chain = chains[0];
      console.log(`${network}: chain progress ${JSON.stringify(chain, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
      if (!chain || chain.progress_block < 0 || !chain.progress_block_time) continue;
      const events = await transaction`select * from ${transaction(schema)}."ExchangeEvent" where "chainId" = ${info.chainId} order by "blockNumber" desc, "logIndex" desc limit 50`;
      result.push({ network, source: 'ENVIO', chainId: info.chainId, contract: info.contract,
        watermark: chain.progress_block, sourceBlock: chain.source_block,
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
  while (running && !existsSync(`${runtime}/stop`)) {
    try { await exportSnapshots(); } catch (error) { console.log(`Waiting for Envio: ${error.message}`); }
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }
}
let closing = false;
async function close() {
  if (closing) return; closing = true; running = false; indexer.kill('SIGTERM');
  await sql.end({ timeout: 3 }); await pg.stop(); output.end(); process.exit(0);
}
process.on('SIGINT', close); process.on('SIGTERM', close);
await loop();
await close();
