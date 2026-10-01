export type Network = "mainnet" | "testnet";
export type Scenario =
  | "valid"
  | "unauthorized"
  | "partial"
  | "interrupted"
  | "duplicate"
  | "tampered";
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
  estimate: {
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
export type Check = {
  name: string;
  result: "PASS" | "FAIL" | "UNKNOWN";
  expected: string;
  observed: string;
  source: string;
};
export type RehearsalInput = {
  network: Network;
  marketId: number;
  direction: "long" | "short";
  positionQuantity: string;
  closeQuantity: string;
  priceLimit: string;
  sizeDecimals: number;
  priceDecimals: number;
  scenario: Scenario;
  snapshotRef?: string;
  snapshotObservedAt?: string;
};
export type Receipt = {
  schemaVersion: number;
  id: string;
  mode: "REPLAY";
  createdAt: string;
  scenario: Scenario;
  authorization: {
    schemaVersion: number;
    mode: "REPLAY";
    network: Network;
    chainId: number;
    accountId: string;
    workerId: string;
    marketId: number;
    direction: "long" | "short";
    positionQuantity: string;
    authorizedCloseQuantity: string;
    priceLimit: string;
    createdAt: string;
    requestDeadline: string;
    maxAttempts: number;
  };
  authorizationDigest: string;
  execution: {
    id: string;
    status: "COMPLETED" | "REJECTED" | "PARTIAL" | "UNKNOWN";
    attemptedOperation: string;
    providerWrites: number;
    simulatedSubmissions: number;
    filledQuantity: string;
    reservedQuantity: string;
    remainingPositionQuantity: string;
    timeline: {
      title: string;
      detail: string;
      state: "complete" | "blocked" | "pending";
    }[];
  };
  checks: Check[];
  limitations: string[];
  integrity: { algorithm: string; digest: string; meaning: string };
};
export type Verification = { valid: boolean; checks: Check[]; meaning: string };
export type Api = {
  markets: (network: Network) => Promise<Markets>;
  liquidity: (input: {
    network: Network;
    marketId: number;
    quantity: string;
    direction: "long" | "short";
  }) => Promise<Liquidity>;
  activity: (network: Network) => Promise<Activity>;
  rehearse: (input: RehearsalInput, key: string) => Promise<Receipt>;
  verify: (receipt: unknown) => Promise<Verification>;
};
export type FormValues = Pick<
  RehearsalInput,
  "positionQuantity" | "closeQuantity" | "priceLimit" | "direction"
>;
export type Resolved = {
  errors: Partial<Record<keyof FormValues, string>>;
  position?: string;
  close?: string;
  price?: string;
};
export type Review = {
  input: RehearsalInput;
  key: string;
  symbol: string;
  resolved: Resolved;
};
