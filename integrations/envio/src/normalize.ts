export const CHAIN_INFO = {
  mainnet: { chainId: 143, contract: '0x34b6552d57a35a1d042ccae1951bd1c370112a6f' },
  testnet: { chainId: 10143, contract: '0x1964c32f0be608e7d29302aff5e61268e72080cc' },
} as const;
export const EVENT_NAMES = ['OrderRequest', 'OrderRequestV2', 'MakerOrderFilled', 'MakerOrderFilledV2', 'TakerOrderFilled', 'TakerOrderFilledV2', 'PositionClosed', 'PositionDecreased'] as const;
export type Network = keyof typeof CHAIN_INFO;
export type IndexedEvent = {
  id: string; chainId: number; contract: string; transactionHash: string; blockHash: string;
  blockNumber: number; logIndex: number; kind: string; marketId: string | null;
  accountId: string | null; quantity: string | null; source: 'ENVIO'; observedAt: string;
  outcome: 'OBSERVED_EVENT'; decoded: string;
};
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
export function safeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Expected a nonnegative safe integer');
  return value;
}
export function uintString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const result = typeof value === 'bigint' ? value.toString() : value;
  if (typeof result !== 'string' || !/^(0|[1-9][0-9]*)$/.test(result)) throw new Error('Expected an exact unsigned integer string or bigint');
  return result;
}
export function hex(value: unknown, length: number): string {
  if (typeof value !== 'string' || !new RegExp(`^0x[0-9a-fA-F]{${length}}$`).test(value)) throw new Error('Malformed chain identifier');
  return value.toLowerCase();
}
function canonical(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw new Error('Unsafe decoded number'); return value.toString(); }
  if (typeof value === 'boolean' || typeof value === 'string' || value === null) return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.entries(record(value)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, val]) => [key, canonical(val)]));
}
/** Only called by Envio handlers. This projection does not imply account ownership or successful execution. */
export function normalizeExchangeEvent(input: unknown): IndexedEvent {
  const raw = record(input), block = record(raw.block), transaction = record(raw.transaction), params = record(raw.params);
  const chainId = safeInteger(raw.chainId), contract = hex(raw.srcAddress, 40);
  if (!Object.values(CHAIN_INFO).some(c => c.chainId === chainId && c.contract === contract)) throw new Error('Unapproved chain or exchange');
  if (typeof raw.eventName !== 'string' || !(EVENT_NAMES as readonly string[]).includes(raw.eventName)) throw new Error('Unapproved exchange event');
  const transactionHash = hex(transaction.hash, 64), logIndex = safeInteger(raw.logIndex);
  const blockNumber = safeInteger(block.number), blockHash = hex(block.hash, 64), timestamp = safeInteger(block.timestamp);
  const observedAt = new Date(timestamp * 1000).toISOString();
  let quantity = uintString(params.lotLNS);
  if (raw.eventName === 'PositionDecreased') {
    const start = uintString(params.startLotLNS), end = uintString(params.endLotLNS);
    if (start === null || end === null || BigInt(end) > BigInt(start)) throw new Error('Invalid position decrease');
    quantity = (BigInt(start) - BigInt(end)).toString();
  }
  if (raw.eventName !== 'PositionClosed' && quantity === null) throw new Error('Missing event quantity');
  const marketId = uintString(params.perpId), accountId = uintString(params.accountId);
  if (!raw.eventName.startsWith('TakerOrderFilled') && (marketId === null || accountId === null)) throw new Error('Missing market or account');
  return { id: `${chainId}:${transactionHash}:${logIndex}`, chainId, contract, transactionHash, blockHash, blockNumber,
    logIndex, kind: raw.eventName, marketId, accountId, quantity,
    source: 'ENVIO', observedAt, outcome: 'OBSERVED_EVENT', decoded: JSON.stringify(canonical(params)) };
}
