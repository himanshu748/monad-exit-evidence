import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { CHAIN_INFO } from '../src/normalize.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await mkdir('.runtime', { recursive: true });
const pg = new EmbeddedPostgres({ databaseDir: `${root}.runtime/postgres`, port: 5439,
  user: 'postgres', password: 'local-development-only', persistent: true, createPostgresUser: false,
  // Loopback TCP only. No OS users, privileged daemon, Docker or Unix socket required.
  postgresFlags: ['-h', '127.0.0.1', '-k', ''], onLog: text => process.stdout.write(text), onError: console.error });
if (!existsSync('.runtime/postgres/PG_VERSION')) await pg.initialise();
await pg.start();
const sql = postgres({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'local-development-only', database: 'postgres', max: 1 });
const output = createWriteStream('.runtime/indexer.log', { flags: 'a' });
const indexer = spawn('./node_modules/.bin/envio', ['start'], { env: { ...process.env,
  ENVIO_PG_HOST: '127.0.0.1', ENVIO_PG_PORT: '5439', ENVIO_PG_USER: 'postgres', ENVIO_PG_PASSWORD: 'local-development-only',
  ENVIO_PG_DATABASE: 'postgres', ENVIO_PG_SCHEMA: 'mandate_envio', ENVIO_HASURA: 'false', ENVIO_TUI: 'false', ENVIO_INDEXER_PORT: '9899' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
      const chains = await transaction`select * from mandate_envio.envio_chains where id = ${info.chainId}`;
      const chain = chains[0];
      console.log(`${network}: chain progress ${JSON.stringify(chain, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
      if (!chain || chain.progress_block < 0 || !chain.progress_block_time) continue;
      const events = await transaction`select * from mandate_envio."ExchangeEvent" where "chainId" = ${info.chainId} order by "blockNumber" desc, "logIndex" desc limit 50`;
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
  while (running && !existsSync('.runtime/stop')) {
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
