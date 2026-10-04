import { boundedText } from "./http.ts";
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHAIN_INFO, EVENT_NAMES, normalizeExchangeEvent, record, safeInteger, uintString, hex, type Network, type IndexedEvent } from '../../integrations/envio/src/normalize.ts';

export type ActivityEvent = IndexedEvent;
export type EnvioActivity = { status: 'live' | 'unavailable'; source: 'ENVIO'; chainId: number; watermark: number | null; windowStartBlock?: number; receivedAt: string; events: ActivityEvent[]; error?: string };
const SNAPSHOT_ROOT = pathToFileURL(resolve(process.cwd(), 'integrations/envio/.runtime') + sep);
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
    const item: ActivityEvent = normalized;
    const previous = seen.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item)) throw new Error('Conflicting duplicate Envio log');
    seen.set(id, item);
  }
  const windowStartBlock = page.indexWindow === undefined ? undefined : safeInteger(record(page.indexWindow).startBlock);
  if (windowStartBlock !== undefined && windowStartBlock > watermark) throw new Error('Invalid index window');
  return { status: 'live', source: 'ENVIO', chainId: info.chainId, watermark, ...(windowStartBlock === undefined ? {} : { windowStartBlock }), receivedAt: new Date(now).toISOString(),
    events: [...seen.values()].sort((a,b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex || a.id.localeCompare(b.id)).slice(0, 50) };
}
/** A configured deployment bridge can read only a known HTTPS tunnel, never a client-supplied URL. */
export function snapshotOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(url.hostname)) throw new Error('Invalid configured Envio snapshot origin');
  return url.origin;
}
export async function getLocalEnvioSnapshot(network: Network, transactionHash?: string, logIndex?: number) {
  if (!CHAIN_INFO[network]) throw new Error('Unsupported network');
  const body = await readFile(new URL(`${network}.json`, SNAPSHOT_ROOT), 'utf8');
  if (body.length > 1_000_000) throw new Error('Indexer response too large');
  const page = record(JSON.parse(body));
  if (transactionHash !== undefined) {
    if (logIndex === undefined) throw new Error('Missing log index');
    const { readIndexedTransaction } = await import('./envio-local.ts');
    return readIndexedTransaction(network, transactionHash, logIndex, page.indexWindow === undefined ? undefined : String(record(page.indexWindow).runtime));
  }
  const validated = parseEnvioSnapshot(page, network);
  // Publish only actual public exchange fields and progress metadata, never a DB/runtime path.
  return { source: page.source, chainId: page.chainId, contract: page.contract,
    watermark: page.watermark, sourceBlock: page.sourceBlock, progressBlockTime: page.progressBlockTime,
    queriedAt: page.queriedAt, events: validated.events,
    ...(validated.windowStartBlock === undefined ? {} : { indexWindow: { startBlock: validated.windowStartBlock } }) };
}
const remote = new Map<Network, { at: number; page: unknown }>();
async function readSnapshot(path: URL): Promise<string> {
  const configured = process.env.ENVIO_SNAPSHOT_ORIGIN;
  if (!configured) return readFile(path, 'utf8');
  const network = path.pathname.endsWith('/mainnet.json') ? 'mainnet' : 'testnet';
  const cached = remote.get(network);
  if (cached && Date.now() - cached.at < 5_000) return JSON.stringify(cached.page);
  const response = await fetch(`${snapshotOrigin(configured)}/api/indexer-snapshot?network=${network}`, {
    redirect: 'error', signal: AbortSignal.timeout(5_000), headers: { accept: 'application/json' },
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error('Envio bridge unavailable'); }
  const envelope = record(JSON.parse(await boundedText(response, 1_000_000)));
  if (envelope.error || !envelope.data) throw new Error('Envio bridge unavailable');
  parseEnvioSnapshot(envelope.data, network);
  remote.set(network, { at: Date.now(), page: envelope.data });
  return JSON.stringify(envelope.data);
}
/** Actual SQL snapshots only, local or configured bridge: no RPC/replay/static data fallback. */
export async function getEnvioActivity(network: Network, reader: (path: URL) => Promise<string> = readSnapshot, now = Date.now()): Promise<EnvioActivity> {
  const info = CHAIN_INFO[network];
  if (!info) throw new Error('Unsupported network');
  try {
    const body = await reader(new URL(`${network}.json`, SNAPSHOT_ROOT));
    if (body.length > 1_000_000) throw new Error('Indexer response too large');
    return parseEnvioSnapshot(JSON.parse(body), network, now);
  } catch {
    return { status: 'unavailable', source: 'ENVIO', chainId: info.chainId, watermark: null, receivedAt: new Date(now).toISOString(), events: [],
      error: 'Envio activity unavailable: its genuine indexer must be running with a fresh verified chain watermark' };
  }
}

/** Read one genuine SQL entity with its committed watermark; never infer a match from a receipt. */
export async function getEnvioIndexedTransaction(network: Network, transactionHash: string, logIndex: number): Promise<EnvioActivity> {
  const hash = hex(transactionHash, 64), index = safeInteger(logIndex);
  try {
    const origin = process.env.ENVIO_SNAPSHOT_ORIGIN;
    if (!origin) return parseEnvioSnapshot(await getLocalEnvioSnapshot(network, hash, index), network);
    const response = await fetch(`${snapshotOrigin(origin)}/api/indexer-snapshot?network=${network}&transactionHash=${hash}&logIndex=${index}`, {
      redirect: 'error', signal: AbortSignal.timeout(5_000), headers: { accept: 'application/json' },
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('Envio bridge unavailable'); }
    const envelope = record(JSON.parse(await boundedText(response, 1_000_000)));
    if (envelope.error || !envelope.data) throw new Error('Envio bridge unavailable');
    const activity = parseEnvioSnapshot(envelope.data, network);
    if (activity.events.length > 1 || activity.events.some(event => event.transactionHash !== hash || event.logIndex !== index)) throw new Error('Mismatched indexed lookup');
    return activity;
  } catch {
    return { status: 'unavailable', source: 'ENVIO', chainId: CHAIN_INFO[network].chainId, watermark: null,
      receivedAt: new Date().toISOString(), events: [], error: 'Indexed transaction lookup unavailable' };
  }
}
