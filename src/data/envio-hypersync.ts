import abi from '../../integrations/envio/abis/Exchange.json' with { type: 'json' };
import { decodeEventLog, toEventSelector, type Abi, type AbiEvent, type Hex } from 'viem';
import { CHAIN_INFO, EVENT_NAMES, normalizeExchangeEvent, record, safeInteger, hex, type Network, type IndexedEvent } from '../../integrations/envio/src/normalize.ts';
import { boundedText } from './http.ts';
import type { EnvioActivity } from './envio.ts';

const ORIGINS = { mainnet: 'https://monad.hypersync.xyz', testnet: 'https://monad-testnet.hypersync.xyz' } as const;
const EVENTS = (abi as unknown as Abi).filter((item): item is AbiEvent => item.type === 'event' && (EVENT_NAMES as readonly string[]).includes(item.name));
const TOPICS = EVENTS.map(event => toEventSelector(event));
const FIELD_SELECTION = {
  block: ['number', 'timestamp', 'hash'],
  log: ['block_number', 'block_hash', 'transaction_hash', 'log_index', 'address', 'data', 'topic0', 'topic1', 'topic2', 'topic3', 'removed'],
};
const WINDOW_BLOCKS = 16, MAX_PAGES = 4, MAX_LOGS = 4000;

/** JSON quantities may be integers or exact hex/decimal strings; never accept lossy floats. */
function integer(value: unknown): number {
  if (typeof value === 'number') return safeInteger(value);
  if (typeof value !== 'string' || !/^(?:0x[0-9a-fA-F]+|0|[1-9][0-9]*)$/.test(value)) throw new Error('Malformed HyperSync integer');
  return safeInteger(Number(BigInt(value)));
}
type Page = { nextBlock: number; archiveHeight: number; blocks: Map<number, { hash: string; timestamp: number }>; events: IndexedEvent[] };

/** Decode only genuine HyperSync rows; independent Monad receipts never populate this source. */
export function parseHyperSyncPage(input: unknown, network: Network, fromBlock: number, toBlock: number, requireLogs = true): Page {
  const info = CHAIN_INFO[network];
  if (!info || safeInteger(fromBlock) >= safeInteger(toBlock)) throw new Error('Invalid HyperSync range');
  const page = record(input), nextBlock = integer(page.next_block), archiveHeight = integer(page.archive_height);
  if (nextBlock <= fromBlock || nextBlock > toBlock || archiveHeight < nextBlock - 1) throw new Error('Incomplete or inconsistent HyperSync progress');
  // JSON API versions return either one row set or a bounded array of row sets.
  const groups = Array.isArray(page.data) ? page.data : [page.data];
  if (groups.length > 20) throw new Error('HyperSync row set too large');
  const blocks = new Map<number, { hash: string; timestamp: number }>(), logs: unknown[] = [];
  for (const inputGroup of groups) {
    const group = record(inputGroup);
    if (!Array.isArray(group.blocks) || (requireLogs && !Array.isArray(group.logs)) || (group.logs !== undefined && !Array.isArray(group.logs)) || group.blocks.length > 32 || (Array.isArray(group.logs) && group.logs.length > MAX_LOGS)) throw new Error('Malformed HyperSync row set');
    for (const inputBlock of group.blocks) {
      const block = record(inputBlock), number = integer(block.number);
      if (number < fromBlock || number >= nextBlock) throw new Error('HyperSync block outside scanned range');
      const value = { hash: hex(block.hash, 64), timestamp: integer(block.timestamp) };
      const prior = blocks.get(number);
      if (prior && (prior.hash !== value.hash || prior.timestamp !== value.timestamp)) throw new Error('Conflicting HyperSync blocks');
      blocks.set(number, value);
      if (blocks.size > 32) throw new Error('HyperSync block limit exceeded');
    }
    logs.push(...(Array.isArray(group.logs) ? group.logs : []));
    if (logs.length > MAX_LOGS) throw new Error('HyperSync event limit exceeded');
  }
  const events = new Map<string, IndexedEvent>();
  for (const inputLog of logs) {
    const log = record(inputLog), number = integer(log.block_number), block = blocks.get(number);
    if (!block || number < fromBlock || number >= nextBlock || hex(log.address, 40) !== info.contract || hex(log.block_hash, 64) !== block.hash || (log.removed !== undefined && log.removed !== null && log.removed !== false)) throw new Error('HyperSync log provenance mismatch');
    if (typeof log.data !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(log.data)) throw new Error('Malformed HyperSync log bytes');
    const topics: Hex[] = [];
    let ended = false;
    for (const name of ['topic0', 'topic1', 'topic2', 'topic3']) {
      const topic = log[name];
      if (topic === null || topic === undefined) ended = true;
      else { if (ended) throw new Error('Malformed HyperSync topics'); topics.push(hex(topic, 64) as Hex); }
    }
    if (!topics.length || !TOPICS.includes(topics[0])) throw new Error('Unrequested HyperSync event');
    const decoded = decodeEventLog({ abi: abi as unknown as Abi, data: log.data as Hex, topics: topics as [Hex, ...Hex[]], strict: true });
    const event = normalizeExchangeEvent({ chainId: info.chainId, srcAddress: info.contract, eventName: decoded.eventName,
      transaction: { hash: hex(log.transaction_hash, 64) }, block: { number, hash: block.hash, timestamp: block.timestamp }, logIndex: integer(log.log_index), params: decoded.args });
    const prior = events.get(event.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(event)) throw new Error('Conflicting HyperSync logs');
    events.set(event.id, event);
  }
  return { nextBlock, archiveHeight, blocks, events: [...events.values()] };
}

type FailureReason = 'token-missing' | 'token-whitespace' | 'token-invalid' | 'http-400' | 'http-401' | 'http-403' | 'http-404' | 'http-413' | 'http-429' | 'http-5xx' | 'http-other' | 'parse' | 'coverage' | 'stale-head' | 'timeout' | 'transport' | 'target-ahead' | 'capacity';
type Diagnostic = { component: 'envio-hypersync'; network: Network; reason: FailureReason; status?: number };
class HyperSyncFailure extends Error {
  readonly reason: FailureReason;
  readonly status?: number;
  constructor(reason: FailureReason, message: string, status?: number) { super(message); this.reason = reason; this.status = status; }
}
const FAILURE_COOLDOWN = 8000, DIAGNOSTIC_COOLDOWN = 30_000, MAX_TARGET_READS = 4;
const HTTP_STATUSES = new Set([400, 401, 403, 404, 413, 429, 500, 502, 503, 504]);

export function createHyperSyncReader(transport: typeof fetch = fetch, token: () => string | undefined = () => process.env.ENVIO_API_TOKEN, now: () => number = Date.now, diagnostic: (item: Diagnostic) => void = item => console.warn(JSON.stringify(item))) {
  const cache = new Map<Network, { at: number; expiresAt: number; activity: EnvioActivity }>();
  const pending = new Map<Network, Promise<EnvioActivity>>();
  const targets = new Map<string, Promise<EnvioActivity>>();
  const failures = new Map<Network, { at: number; until: number; failure: HyperSyncFailure }>();
  const reported = new Map<string, number>(); // Two networks times a fixed finite reason set.
  function requireSource(network: Network) {
    if (!CHAIN_INFO[network]) throw new Error('Unsupported network');
    const prior = failures.get(network);
    if (prior && Math.max(now(), prior.at) < prior.until) throw prior.failure;
    if (prior) failures.delete(network);
  }
  function report(network: Network, failure: HyperSyncFailure) {
    const key = `${network}:${failure.reason}`, previous = reported.get(key), time = now();
    if (previous !== undefined && Math.max(time, previous) - previous < DIAGNOSTIC_COOLDOWN) return;
    reported.set(key, time);
    // Only fixed enums and allowlisted numeric statuses. Never log raw errors,
    // tokens, response bodies, URLs, transaction/account values or IPs.
    try { diagnostic({ component: 'envio-hypersync', network, reason: failure.reason,
      ...(failure.status !== undefined && HTTP_STATUSES.has(failure.status) ? { status: failure.status } : {}) }); }
    catch { /* Operator logging cannot change the reader's fail-closed behavior. */ }
  }
  async function query(network: Network, path: '/height' | '/query', body: unknown | undefined, deadline: AbortSignal) {
    const secret = token();
    if (!secret) throw new HyperSyncFailure('token-missing', 'Authorized free HyperSync access is required');
    if (/\s/.test(secret)) throw new HyperSyncFailure('token-whitespace', 'Authorized free HyperSync access is required');
    if (secret.length > 8192) throw new HyperSyncFailure('token-invalid', 'Authorized free HyperSync access is required');
    const signal = AbortSignal.any([deadline, AbortSignal.timeout(8000)]);
    let response: Response;
    try {
      response = await transport(ORIGINS[network] + path, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal,
      });
    } catch {
      throw new HyperSyncFailure(signal.aborted ? 'timeout' : 'transport', 'HyperSync transport unavailable');
    }
    if (!response.ok) {
      await response.body?.cancel();
      const status = response.status;
      const reason: FailureReason = status === 400 ? 'http-400' : status === 401 ? 'http-401' : status === 403 ? 'http-403' : status === 404 ? 'http-404' : status === 413 ? 'http-413' : status === 429 ? 'http-429' : status >= 500 ? 'http-5xx' : 'http-other';
      throw new HyperSyncFailure(reason, 'HyperSync unavailable or rate limited', status);
    }
    try { return record(JSON.parse(await boundedText(response, 2_000_000))); }
    catch { throw new HyperSyncFailure(signal.aborted ? 'timeout' : 'parse', 'Invalid HyperSync response'); }
  }
  async function read(network: Network, target?: { hash: string; logIndex: number; blockNumber: number }): Promise<EnvioActivity> {
    const started = now(), deadline = AbortSignal.timeout(20_000);
    // Keep the strict 16-block preview and prove every scanned block.
    const height = integer((await query(network, '/height', undefined, deadline)).height);
    if (height < 1) throw new HyperSyncFailure('coverage', 'HyperSync has not indexed a block');
    const headPage = parseHyperSyncPage(await query(network, '/query', { from_block: height - 1, to_block: height,
      include_all_blocks: true, field_selection: { block: FIELD_SELECTION.block }, max_num_blocks: 1 }, deadline), network, height - 1, height, false);
    const head = headPage.blocks.get(height - 1);
    if (!head || headPage.nextBlock !== height) throw new HyperSyncFailure('coverage', 'HyperSync head not covered');
    const headAge = now() - head.timestamp * 1000;
    if (headAge > 300_000 || headAge < -30_000) throw new HyperSyncFailure('stale-head', 'HyperSync head is stale');
    const fromBlock = target ? target.blockNumber : Math.max(0, height - WINDOW_BLOCKS);
    const toBlock = target ? fromBlock + 1 : height;
    // A valid but not-yet-indexed target must not poison reads for the network.
    if (!Number.isSafeInteger(toBlock) || toBlock > height) throw new HyperSyncFailure('target-ahead', 'Transaction is ahead of HyperSync');
    let cursor = fromBlock, count = 0;
    const events = new Map<string, IndexedEvent>();
    for (let pageIndex = 0; cursor < toBlock && pageIndex < MAX_PAGES; pageIndex++) {
      const page = parseHyperSyncPage(await query(network, '/query', { from_block: cursor, to_block: toBlock,
        logs: [{ address: [CHAIN_INFO[network].contract], topics: [TOPICS] }], include_all_blocks: true,
        field_selection: FIELD_SELECTION, max_num_logs: 512, max_num_blocks: 32 }, deadline), network, cursor, toBlock);
      if (page.blocks.size !== page.nextBlock - cursor) throw new HyperSyncFailure('coverage', 'HyperSync block coverage incomplete');
      for (const [number, block] of page.blocks) {
        if (block.timestamp * 1000 > now() + 30_000) throw new HyperSyncFailure('stale-head', 'HyperSync block timestamp is in the future');
        if (number === height - 1 && (block.hash !== head.hash || block.timestamp !== head.timestamp)) throw new HyperSyncFailure('coverage', 'HyperSync head changed during query');
      }
      count += page.events.length;
      if (count > MAX_LOGS) throw new HyperSyncFailure('coverage', 'HyperSync total event limit exceeded');
      for (const event of page.events) {
        const prior = events.get(event.id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(event)) throw new HyperSyncFailure('coverage', 'Conflicting HyperSync pages');
        events.set(event.id, event);
      }
      cursor = page.nextBlock;
    }
    if (now() - started > 20_000) throw new HyperSyncFailure('timeout', 'HyperSync read deadline exceeded');
    if (now() - head.timestamp * 1000 > 300_000) throw new HyperSyncFailure('stale-head', 'HyperSync head is stale');
    if (cursor !== toBlock) throw new HyperSyncFailure('coverage', 'HyperSync window incomplete');
    const selected = [...events.values()].filter(event => !target || (event.transactionHash === target.hash && event.logIndex === target.logIndex));
    return { status: 'live', source: 'ENVIO', engine: 'HYPERSYNC', sourceUrl: ORIGINS[network], chainId: CHAIN_INFO[network].chainId,
      watermark: cursor - 1, providerHead: height - 1, providerHeadObservedAt: new Date(head.timestamp * 1000).toISOString(), windowStartBlock: fromBlock, receivedAt: new Date(started).toISOString(),
      events: selected.sort((a,b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex).slice(0, target ? 1 : 50) };
  }
  async function guardedRead(network: Network, target?: { hash: string; logIndex: number; blockNumber: number }) {
    requireSource(network);
    try { return await read(network, target); }
    catch (error) {
      const failure = error instanceof HyperSyncFailure ? error : new HyperSyncFailure('parse', 'Invalid HyperSync response');
      if (failure.reason !== 'target-ahead') {
        const at = now(); failures.set(network, { at, until: at + FAILURE_COOLDOWN, failure });
        cache.delete(network);
      }
      report(network, failure);
      throw failure;
    }
  }
  async function activity(network: Network): Promise<EnvioActivity> {
    requireSource(network);
    const cached = cache.get(network);
    if (cached && now() >= cached.at && now() < cached.expiresAt) return cached.activity;
    const inFlight = pending.get(network);
    if (inFlight) return inFlight;
    const task = guardedRead(network).then(activity => {
      // Another concurrent read may have failed; it still owns the cooldown.
      if (!failures.has(network)) cache.set(network, { at: now(), expiresAt: Math.min(now() + 10_000, Date.parse(activity.providerHeadObservedAt!) + 300_000), activity });
      return activity;
    });
    pending.set(network, task);
    try { return await task; } finally { pending.delete(network); }
  }
  async function transaction(network: Network, transactionHash: string, logIndex: number, blockNumber: number) {
    // Validate user parameters before shared provider state or upstream access.
    const target = { hash: hex(transactionHash, 64), logIndex: safeInteger(logIndex), blockNumber: safeInteger(blockNumber) };
    requireSource(network);
    const key = `${network}:${target.hash}:${target.logIndex}:${target.blockNumber}`, existing = targets.get(key);
    if (existing) return existing;
    if (targets.size >= MAX_TARGET_READS) throw new HyperSyncFailure('capacity', 'HyperSync lookup capacity reached');
    const task = guardedRead(network, target); targets.set(key, task);
    try { return await task; } finally { targets.delete(key); }
  }
  return { activity, transaction };
}
export const hyperSync = createHyperSyncReader();
