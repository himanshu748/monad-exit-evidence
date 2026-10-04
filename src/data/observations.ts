import { boundedText } from "./http.ts";
import abi from '../../integrations/envio/abis/Exchange.json' with { type: 'json' };
import { decodeEventLog, type Hex, type Abi } from 'viem';
import { CHAIN_INFO, EVENT_NAMES, normalizeExchangeEvent, record, safeInteger, hex, type IndexedEvent } from '../../integrations/envio/src/normalize.ts';
import { getEnvioActivity } from './envio.ts';
import { requireNetwork } from './perpl.ts';
import { digest } from '../core/receipt.ts';
import type { Network } from '../core/types.ts';

const RPC = { mainnet: 'https://rpc.monad.xyz', testnet: 'https://testnet-rpc.monad.xyz' } as const;
function rpcInteger(value: unknown): number {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) throw new Error('Malformed RPC integer');
  return safeInteger(Number(BigInt(value)));
}
async function call(network: Network, method: string, params: unknown[]) {
  const response = await fetch(RPC[network], { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(12_000) });
  const text = await boundedText(response, 2_000_000);
  if (!response.ok || text.length > 2_000_000) throw new Error('Public Monad RPC unavailable');
  const body = record(JSON.parse(text));
  if (body.error || !Object.hasOwn(body, 'result')) throw new Error('Public Monad RPC unavailable');
  return body.result;
}

export function sameIndexedObservation(indexed: IndexedEvent, observed: IndexedEvent): boolean {
  return Object.keys(observed).every(key => indexed[key as keyof IndexedEvent] === observed[key as keyof IndexedEvent]);
}

/** Independently decode a real public exchange log. No execution, fixture or RPC activity fallback. */
export async function getTransactionObservation(network: Network, transactionHash: string, logIndex?: number) {
  requireNetwork(network);
  const hash = hex(transactionHash, 64);
  if (logIndex !== undefined) safeInteger(logIndex);
  const info = CHAIN_INFO[network];
  const indexed = await getEnvioActivity(network);
  const [chain, receiptValue] = await Promise.all([
    call(network, 'eth_chainId', []), call(network, 'eth_getTransactionReceipt', [hash]),
  ]);
  if (rpcInteger(chain) !== info.chainId) throw new Error('Public RPC network mismatch');
  if (receiptValue === null) throw new Error('Transaction receipt is not available on this network');
  const receipt = record(receiptValue);
  if (hex(receipt.transactionHash, 64) !== hash || receipt.status !== '0x1') throw new Error('Transaction is mismatched or did not succeed');
  const blockNumber = rpcInteger(receipt.blockNumber), blockHash = hex(receipt.blockHash, 64);
  const block = record(await call(network, 'eth_getBlockByNumber', [receipt.blockNumber, false]));
  if (hex(block.hash, 64) !== blockHash || rpcInteger(block.number) !== blockNumber) throw new Error('Receipt no longer matches the canonical block');
  if (!Array.isArray(receipt.logs) || receipt.logs.length > 10000) throw new Error('Unsupported receipt log list');
  let observed: ReturnType<typeof normalizeExchangeEvent> | undefined;
  for (const value of receipt.logs) {
    const log = record(value);
    if (hex(log.address, 40) !== info.contract || (logIndex !== undefined && rpcInteger(log.logIndex) !== logIndex)) continue;
    if (log.removed === true || hex(log.transactionHash, 64) !== hash || hex(log.blockHash, 64) !== blockHash || rpcInteger(log.blockNumber) !== blockNumber) throw new Error('Log provenance mismatch');
    if (typeof log.data !== 'string' || !/^0x(?:[0-9a-f]{2})*$/i.test(log.data) || !Array.isArray(log.topics) || log.topics.length > 4) throw new Error('Malformed public log');
    let decoded: Record<string, unknown>;
    try { decoded = record(decodeEventLog({ abi: abi as unknown as Abi, data: log.data as Hex, topics: log.topics.map(t => hex(t, 64)) as [Hex, ...Hex[]], strict: true })); }
    catch { continue; }
    if (typeof decoded.eventName !== 'string' || !(EVENT_NAMES as readonly string[]).includes(decoded.eventName)) continue;
    observed = normalizeExchangeEvent({ chainId: info.chainId, srcAddress: info.contract, eventName: decoded.eventName,
      transaction: { hash }, block: { number: blockNumber, hash: blockHash, timestamp: rpcInteger(block.timestamp) },
      logIndex: rpcInteger(log.logIndex), params: decoded.args });
    break;
  }
  if (!observed) throw new Error('No supported Perpl Exchange event found for this transaction/log');
  const match = indexed.events.find(e => e.id === observed.id);
  const matches = !!match && sameIndexedObservation(match, observed);
  const indexStatus = indexed.status !== 'live' ? 'UNAVAILABLE' : !match ? 'NOT_IN_CURRENT_PAGE' : matches ? 'MATCH' : 'MISMATCH';
  const checks = [
    { name: 'RPC network', result: 'PASS', observed: String(info.chainId) },
    { name: 'Successful transaction receipt', result: 'PASS', observed: hash },
    { name: 'Canonical block and exchange log', result: 'PASS', observed: `${blockHash} · ${info.contract}` },
    { name: 'Strict ABI decode', result: 'PASS', observed: observed.kind },
    { name: 'Envio indexed values', result: indexStatus === 'MATCH' ? 'PASS' : indexStatus === 'MISMATCH' ? 'FAIL' : 'UNKNOWN', observed: indexStatus },
  ];
  const body = {
    schema: 'exit-evidence-observation/v1', network, chainId: info.chainId, verifiedAt: new Date().toISOString(),
    outcome: indexStatus === 'MATCH' ? 'INDEX_AND_CHAIN_MATCH' : indexStatus === 'MISMATCH' ? 'SOURCE_MISMATCH' : 'CHAIN_OBSERVED',
    sourceUrl: RPC[network], observation: { ...observed, source: 'MONAD_PUBLIC_RPC', decoded: JSON.parse(observed.decoded) },
    envio: { status: indexStatus, watermark: indexed.watermark, checkedAt: indexed.receivedAt }, checks,
    limitations: [
      'This is a public participant event, not proof of viewer ownership or execution by this app.',
      'OrderRequest is a request observation, not a fill. Null account/market/quantity fields are not inferred.',
      'Canonical block checks are point-in-time provider observations, not a finality guarantee.',
      'The digest detects changed export bytes; it does not authenticate an owner or independently establish truth.',
    ],
  };
  return { ...body, integrity: { algorithm: 'SHA-256', digest: digest(body) } };
}
