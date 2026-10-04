import { boundedText } from "./http.ts";
import type { Network } from "../core/types.ts";
import {
  parseUnits,
  formatUnits,
  precision,
  integer,
} from "../core/quantity.ts";
import { digest } from "../core/receipt.ts";
const ORIGINS = {
  mainnet: "https://app.perpl.xyz/api",
  testnet: "https://testnet.perpl.xyz/api",
} as const;
export type Market = {
  id: number;
  name: string;
  symbol: string;
  sizeDecimals: number;
  priceDecimals: number;
  markPrice: string;
  bidPrice: string;
  askPrice: string;
  openInterest: string;
  dailyVolume: string;
  fundingRate: string;
  isOpen: boolean;
  observedAt: string;
};
export type MarketContext = {
  network: Network;
  chainId: number;
  source: "PERPL_PUBLIC_API";
  sourceUrl: string;
  receivedAt: string;
  observedAt: string;
  snapshotRef: string;
  snapshotObservedAt: string;
  stale: boolean;
  markets: Market[];
};
function object(x: unknown): Record<string, any> {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new Error("Invalid provider object");
  return x as Record<string, any>;
}
function safe(x: unknown): number {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x < 0)
    throw new Error("Unsafe or missing provider integer");
  return x;
}
function raw(x: unknown): bigint {
  return typeof x === "number" ? BigInt(safe(x)) : integer(x as string);
}
function timestamp(x: unknown): string {
  const n = safe(x);
  if (n < 1500000000000 || n > 4102444800000)
    throw new Error("Invalid provider timestamp");
  return new Date(n).toISOString();
}
export function requireNetwork(network: unknown): Network {
  if (network !== "mainnet" && network !== "testnet")
    throw new Error("Choose mainnet or testnet explicitly");
  return network;
}
export function normalizeContext(
  value: unknown,
  network: Network,
  now = Date.now(),
): MarketContext {
  requireNetwork(network);
  const data = object(value),
    chain = object(data.chain);
  const chainId = safe(chain.chain_id);
  if (chainId !== (network === "mainnet" ? 143 : 10143))
    throw new Error("Provider network mismatch");
  if (!Array.isArray(data.markets) || data.markets.length > 1000)
    throw new Error("Invalid market list");
  if (!Array.isArray(data.instances) || !Array.isArray(data.tokens))
    throw new Error("Missing protocol instances or collateral tokens");
  const markets: Market[] = data.markets.map((unknownMarket: unknown) => {
    const m = object(unknownMarket),
      c = object(m.config),
      s = object(m.state);
    const instance = object(
      data.instances.find((i: any) => i.id === safe(m.instance_id)),
    );
    const collateral = object(
      data.tokens.find((t: any) => t.id === safe(instance.collateral_token_id)),
    );
    const collateralDecimals = safe(collateral.decimals);
    precision(collateralDecimals);
    const pd = safe(c.price_decimals),
      sd = safe(c.size_decimals);
    precision(pd);
    precision(sd);
    const f = object(m.funding);
    if (typeof f.rate !== "number" || !Number.isSafeInteger(f.rate))
      throw new Error("Missing funding rate");
    if (typeof c.is_open !== "boolean") throw new Error("Missing open status");
    return {
      id: safe(m.id),
      name: String(m.name ?? m.symbol ?? m.size_units).slice(0, 80),
      symbol: String(m.symbol || m.size_units || m.name).slice(0, 20),
      sizeDecimals: sd,
      priceDecimals: pd,
      markPrice: formatUnits(raw(s.mrk), pd),
      bidPrice: formatUnits(raw(s.bid), pd),
      askPrice: formatUnits(raw(s.ask), pd),
      openInterest: formatUnits(raw(s.oi), sd),
      dailyVolume: formatUnits(raw(s.dva), collateralDecimals),
      fundingRate: formatUnits(BigInt(f.rate), 4),
      isOpen: c.is_open,
      observedAt: timestamp(object(s.at).t),
    };
  });
  const times = markets.map((m) => Date.parse(m.observedAt));
  const observedAt = new Date(
    times.length ? Math.min(...times) : now,
  ).toISOString();
  const snapshotRef = digest({ chainId, markets });
  return {
    network,
    chainId,
    source: "PERPL_PUBLIC_API",
    sourceUrl: ORIGINS[network] + "/v1/pub/context",
    receivedAt: new Date(now).toISOString(),
    observedAt,
    snapshotRef,
    snapshotObservedAt: observedAt,
    stale: times.some((t) => now - t > 120000 || t > now + 15000),
    markets,
  };
}
export type RawLevel = { p: bigint; s: bigint };
export function normalizeBook(
  value: unknown,
  priceDecimals: number,
  sizeDecimals: number,
) {
  const data = object(value);
  precision(priceDecimals);
  precision(sizeDecimals);
  if (
    data.mt !== 15 ||
    !Array.isArray(data.bid) ||
    !Array.isArray(data.ask) ||
    data.bid.length > 100 ||
    data.ask.length > 100
  )
    throw new Error("Invalid depth snapshot");
  const levels = (xs: unknown[], side: "bid" | "ask"): RawLevel[] => {
    const out = xs.map((x) => {
      const l = object(x);
      const p = raw(l.p),
        s = raw(l.s);
      if (p <= 0n || s <= 0n) throw new Error("Invalid book level");
      return { p, s };
    });
    for (let i = 1; i < out.length; i++)
      if (side === "bid" ? out[i].p > out[i - 1].p : out[i].p < out[i - 1].p)
        throw new Error("Unsorted order book");
    return out;
  };
  return {
    observedAt: timestamp(object(data.at).t),
    bid: levels(data.bid, "bid"),
    ask: levels(data.ask, "ask"),
  };
}
export function estimateDepth(
  levels: RawLevel[],
  target: bigint,
  sizeDecimals: number,
  priceDecimals: number,
) {
  let left = target,
    total = 0n,
    weighted = 0n,
    worst: bigint | null = null;
  for (const l of levels) {
    const take = l.s < left ? l.s : left;
    if (take <= 0n) break;
    total += take;
    weighted += take * l.p;
    left -= take;
    worst = l.p;
  }
  const available = levels.reduce((s, l) => s + l.s, 0n);
  return {
    requestedQuantity: formatUnits(target, sizeDecimals),
    availableQuantity: formatUnits(available, sizeDecimals),
    estimatedFilledQuantity: formatUnits(total, sizeDecimals),
    estimatedAveragePrice: total
      ? formatUnits(weighted / total, priceDecimals)
      : null,
    worstPrice: worst === null ? null : formatUnits(worst, priceDecimals),
    depthLimited: left > 0n,
    meaning:
      "Current visible order-book snapshot only; no guaranteed price, availability or actual execution. Average price rounds down to displayed price precision.",
  };
}
const cache = new Map<Network, { time: number; data: MarketContext }>();
export const snapshots = new Map<
  string,
  { time: number; data: MarketContext }
>();
export async function publicRead(
  network: Network,
  path: string,
): Promise<unknown> {
  requireNetwork(network);
  if (!/^\/v1\/(pub\/context|market-data\/\d+\/book\?levels=100)$/.test(path))
    throw new Error("Read path not allowed");
  const response = await fetch(ORIGINS[network] + path, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
    headers: { accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`Perpl public data unavailable (HTTP ${response.status})`);
  const text = await boundedText(response, 2_000_000);
  return JSON.parse(text);
}
export async function getMarkets(network: Network): Promise<MarketContext> {
  const now = Date.now(),
    old = cache.get(network);
  if (old && now - old.time < 15000)
    return {
      ...old.data,
      stale: old.data.markets.some(
        (m) =>
          now - Date.parse(m.observedAt) > 120000 ||
          Date.parse(m.observedAt) > now + 15000,
      ),
    };
  const data = normalizeContext(
    await publicRead(network, "/v1/pub/context"),
    network,
  );
  cache.set(network, { time: Date.now(), data });
  snapshots.set(data.snapshotRef, { time: Date.now(), data });
  for (const [key, s] of snapshots)
    if (Date.now() - s.time > 180000) snapshots.delete(key);
  return data;
}
export async function getLiquidity(
  network: Network,
  marketId: number,
  quantity: string,
  direction: string,
) {
  if (
    !Number.isSafeInteger(marketId) ||
    marketId <= 0 ||
    !["long", "short"].includes(direction)
  )
    throw new Error("Invalid market or direction");
  const context = await getMarkets(network);
  const market = context.markets.find((m) => m.id === marketId);
  if (!market) throw new Error("Unknown market");
  const target = parseUnits(quantity, market.sizeDecimals);
  if (target === 0n) throw new Error("Quantity must be positive");
  const path = `/v1/market-data/${marketId}/book?levels=100`;
  const book = normalizeBook(
    await publicRead(network, path),
    market.priceDecimals,
    market.sizeDecimals,
  );
  const toDisplay = (l: RawLevel) => ({
    price: formatUnits(l.p, market.priceDecimals),
    quantity: formatUnits(l.s, market.sizeDecimals),
  });
  return {
    network,
    chainId: context.chainId,
    marketId,
    source: "PERPL_PUBLIC_API",
    sourceUrl: ORIGINS[network] + path,
    receivedAt: new Date().toISOString(),
    observedAt: book.observedAt,
    stale:
      context.stale ||
      Date.now() - Date.parse(book.observedAt) > 120000 ||
      Date.parse(book.observedAt) > Date.now() + 15000,
    sizeDecimals: market.sizeDecimals,
    priceDecimals: market.priceDecimals,
    bids: book.bid.map(toDisplay),
    asks: book.ask.map(toDisplay),
    estimate: estimateDepth(
      direction === "long" ? book.bid : book.ask,
      target,
      market.sizeDecimals,
      market.priceDecimals,
    ),
  };
}

/** Actual book levels without inventing a default position or requested quantity. */
export async function getOrderBook(network: Network, marketId: number) {
  if (!Number.isSafeInteger(marketId) || marketId <= 0) throw new Error("Invalid market");
  const context = await getMarkets(network);
  const market = context.markets.find(m => m.id === marketId);
  if (!market) throw new Error("Unknown market");
  const path = `/v1/market-data/${marketId}/book?levels=100`;
  const book = normalizeBook(await publicRead(network, path), market.priceDecimals, market.sizeDecimals);
  const display = (level: RawLevel) => ({ price: formatUnits(level.p, market.priceDecimals), quantity: formatUnits(level.s, market.sizeDecimals) });
  return { network, chainId: context.chainId, marketId, source: "PERPL_PUBLIC_API", sourceUrl: ORIGINS[network] + path,
    receivedAt: new Date().toISOString(), observedAt: book.observedAt,
    stale: context.stale || Date.now() - Date.parse(book.observedAt) > 120000 || Date.parse(book.observedAt) > Date.now() + 15000,
    sizeDecimals: market.sizeDecimals, priceDecimals: market.priceDecimals, bids: book.bid.map(display), asks: book.ask.map(display) };
}
