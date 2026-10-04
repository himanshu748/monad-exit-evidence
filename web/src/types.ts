export type Network = "mainnet" | "testnet";
export type Market = {
  id: number;
  name: string;
  symbol: string;
  sizeDecimals: number;
  priceDecimals: number;
  markPrice: string;
  bidPrice: string;
  askPrice: string;
  isOpen: boolean;
  observedAt: string;
};
export type Markets = {
  network: Network;
  chainId: number;
  source: string;
  sourceUrl: string;
  receivedAt: string;
  observedAt: string;
  stale: boolean;
  snapshotRef?: string;
  markets: Market[];
};
export type Level = { price: string; quantity: string };
export type Liquidity = {
  network: Network;
  chainId: number;
  marketId: number;
  source: string;
  sourceUrl: string;
  receivedAt: string;
  observedAt: string;
  stale: boolean;
  sizeDecimals: number;
  priceDecimals: number;
  bids: Level[];
  asks: Level[];
  estimate?: {
    requestedQuantity: string;
    availableQuantity: string;
    estimatedFilledQuantity: string;
    estimatedAveragePrice: string | null;
    worstPrice: string | null;
    depthLimited: boolean;
    meaning: string;
  };
};
export type Activity = {
  status: "live" | "unavailable";
  source: "ENVIO";
  chainId: number;
  watermark: number | null;
  windowStartBlock?: number;
  engine?: "HYPERINDEX" | "HYPERSYNC";
  sourceUrl?: string;
  providerHead?: number;
  providerHeadObservedAt?: string;
  receivedAt: string;
  events: {
    id: string;
    transactionHash: string;
    blockNumber: number;
    logIndex: number;
    kind: string;
    marketId: string | null;
    accountId: string | null;
    quantity: string | null;
    source: "ENVIO";
  }[];
  error?: string;
};
export type Api = {
  markets: (network: Network) => Promise<Markets>;
  liquidity: (input: {
    network: Network;
    marketId: number;
    quantity: string;
    direction: "long" | "short";
  }) => Promise<Liquidity>;
  activity: (network: Network, signal?: AbortSignal) => Promise<Activity>;
  book: (network: Network, marketId: number) => Promise<Liquidity>;
  observe: (
    network: Network,
    transactionHash: string,
    logIndex: string,
  ) => Promise<Observation>;
};
export type Observation = {
  schema: string;
  network: Network;
  chainId: number;
  verifiedAt: string;
  sourceUrl: string;
  outcome: "INDEX_AND_CHAIN_MATCH" | "SOURCE_MISMATCH" | "CHAIN_OBSERVED";
  observation: {
    id: string;
    transactionHash: string;
    blockHash: string;
    blockNumber: number;
    logIndex: number;
    kind: string;
    marketId: string | null;
    accountId: string | null;
    quantity: string | null;
    observedAt: string;
    source: "MONAD_PUBLIC_RPC";
    decoded: unknown;
  };
  envio: {
    status:
      | "MATCH"
      | "MISMATCH"
      | "MISSING_IN_INDEX"
      | "UNAVAILABLE"
      | "NOT_IN_CURRENT_PAGE";
    watermark: number | null;
    checkedAt: string;
    engine?: "HYPERINDEX" | "HYPERSYNC";
    sourceUrl?: string;
    providerHead?: number;
    providerHeadObservedAt?: string;
    windowStartBlock?: number;
  };
  checks: {
    name: string;
    result: "PASS" | "FAIL" | "UNKNOWN";
    observed: string;
  }[];
  limitations: string[];
  integrity: { algorithm: string; digest: string };
};
