import postgres from 'postgres';
import { CHAIN_INFO, hex, safeInteger, type Network } from '../../integrations/envio/src/normalize.ts';
import { parseEnvioSnapshot } from './envio.ts';

// Existing embedded development database, loopback only; no remote DB configuration.
const sql = postgres({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'local-development-only', database: 'postgres', max: 1, connect_timeout: 2, idle_timeout: 5 });
export async function readIndexedTransaction(network: Network, transactionHash: string, logIndex: number, runtime?: string) {
  const info = CHAIN_INFO[network], hash = hex(transactionHash, 64), index = safeInteger(logIndex);
  const match = runtime?.match(/^\.runtime\/recent(?:-([a-z0-9][a-z0-9-]{0,31}))?$/);
  if (runtime && runtime !== '.runtime' && !match) throw new Error('Invalid local runtime');
  const schema = match ? `mandate_envio_recent${match[1] ? '_' + match[1].replaceAll('-', '_') : ''}` : 'mandate_envio';
  const health = await fetch('http://127.0.0.1:9899/healthz', { signal: AbortSignal.timeout(2_000), redirect: 'error' });
  await health.body?.cancel();
  if (!health.ok) throw new Error('Indexer unavailable');
  const page = await sql.begin('isolation level repeatable read read only', async tx => {
    await tx`set local statement_timeout = '2000ms'`;
    const [chain] = await tx`select * from ${tx(schema)}.envio_chains where id = ${info.chainId}`;
    if (!chain) throw new Error('Missing chain progress');
    const events = await tx`select * from ${tx(schema)}."ExchangeEvent" where id = ${`${info.chainId}:${hash}:${index}`} and "chainId" = ${info.chainId}`;
    return { source: 'ENVIO', chainId: info.chainId, contract: info.contract,
      watermark: chain.progress_block, sourceBlock: chain.source_block,
      progressBlockTime: Math.floor(new Date(chain.progress_block_time).getTime() / 1000),
      queriedAt: new Date().toISOString(), indexWindow: { startBlock: chain.start_block }, events };
  });
  parseEnvioSnapshot(page, network);
  return page;
}
