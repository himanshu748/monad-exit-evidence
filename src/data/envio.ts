import { readFile } from 'node:fs/promises';
import { CHAIN_INFO, EVENT_NAMES, normalizeExchangeEvent, record, safeInteger, uintString, hex, type Network } from '../../integrations/envio/src/normalize.ts';

export type ActivityEvent = { id: string; transactionHash: string; blockNumber: number; logIndex: number; kind: string; marketId: string | null; accountId: string | null; quantity: string | null; source: 'ENVIO' };
export type EnvioActivity = { status: 'live' | 'unavailable'; source: 'ENVIO'; chainId: number; watermark: number | null; receivedAt: string; events: ActivityEvent[]; error?: string };
const SNAPSHOT_ROOT = new URL('../../integrations/envio/.runtime/', import.meta.url);
function timestamp(value: unknown): number {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Missing source timestamp');
  return Date.parse(value);
}
/** Fail closed: a fetched page is not proof of an up-to-date Envio chain watermark. */
export function parseEnvioSnapshot(input: unknown, network: Network, now = Date.now()): EnvioActivity {
  const info = CHAIN_INFO[network];
  if (!info) throw new Error('Unsupported network');
  const page = record(input);
  if (page.source !== 'ENVIO' || page.chainId !== info.chainId || hex(page.contract, 40) !== info.contract) throw new Error('Envio source/network mismatch');
  const watermark = safeInteger(page.watermark), sourceBlock = safeInteger(page.sourceBlock);
  const age = now - timestamp(page.queriedAt), progressAge = now - safeInteger(page.progressBlockTime) * 1000;
  if (watermark > sourceBlock || age > 120_000 || age < -30_000 || progressAge > 300_000 || progressAge < -30_000) throw new Error('Envio watermark is stale or inconsistent');
  if (!Array.isArray(page.events) || page.events.length > 200) throw new Error('Invalid Envio event page');
  const seen = new Map<string, ActivityEvent>();
  const fingerprints = new Map<string, string>();
  for (const inputEvent of page.events) {
    const event = record(inputEvent), transactionHash = hex(event.transactionHash, 64), logIndex = safeInteger(event.logIndex), blockNumber = safeInteger(event.blockNumber);
    const id = `${info.chainId}:${transactionHash}:${logIndex}`;
    if (event.id !== id || event.chainId !== info.chainId || hex(event.contract, 40) !== info.contract || event.source !== 'ENVIO' || blockNumber > watermark) throw new Error('Invalid Envio event provenance');
    if (typeof event.kind !== 'string' || !(EVENT_NAMES as readonly string[]).includes(event.kind)) throw new Error('Invalid Envio event kind');
    if (typeof event.decoded !== 'string') throw new Error('Missing decoded Envio parameters');
    const normalized = normalizeExchangeEvent({ chainId: event.chainId, srcAddress: event.contract, eventName: event.kind,
      transaction: { hash: transactionHash }, block: { number: blockNumber, hash: event.blockHash, timestamp: timestamp(event.observedAt) / 1000 },
      logIndex, params: JSON.parse(event.decoded) });
    for (const [key, value] of Object.entries(normalized)) if (event[key] !== value) throw new Error('Corrupt Envio event projection');
    const fingerprint = JSON.stringify(normalized);
    if (fingerprints.has(id) && fingerprints.get(id) !== fingerprint) throw new Error('Conflicting duplicate Envio provenance');
    fingerprints.set(id, fingerprint);
    const item: ActivityEvent = { id, transactionHash, blockNumber, logIndex, kind: event.kind,
      marketId: uintString(event.marketId), accountId: uintString(event.accountId), quantity: uintString(event.quantity), source: 'ENVIO' };
    const previous = seen.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item)) throw new Error('Conflicting duplicate Envio log');
    seen.set(id, item);
  }
  return { status: 'live', source: 'ENVIO', chainId: info.chainId, watermark, receivedAt: new Date(now).toISOString(),
    events: [...seen.values()].sort((a,b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex || a.id.localeCompare(b.id)).slice(0, 50) };
}
/** Atomic local Envio SQL snapshots only: no RPC fallback, replay data, or static evidence fixtures. */
export async function getEnvioActivity(network: Network, reader: (path: URL) => Promise<string> = path => readFile(path, 'utf8'), now = Date.now()): Promise<EnvioActivity> {
  const info = CHAIN_INFO[network];
  if (!info) throw new Error('Unsupported network');
  try {
    const body = await reader(new URL(`${network}.json`, SNAPSHOT_ROOT));
    if (body.length > 1_000_000) throw new Error('Indexer response too large');
    return parseEnvioSnapshot(JSON.parse(body), network, now);
  } catch {
    return { status: 'unavailable', source: 'ENVIO', chainId: info.chainId, watermark: null, receivedAt: new Date(now).toISOString(), events: [],
      error: 'Envio activity unavailable: the local indexer must be running with a fresh verified chain watermark' };
  }
}
