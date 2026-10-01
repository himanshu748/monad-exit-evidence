export type Network = "mainnet" | "testnet";
export type Scenario =
  | "valid"
  | "unauthorized"
  | "partial"
  | "interrupted"
  | "duplicate"
  | "tampered";
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
export type Policy = {
  schemaVersion: 1;
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
  maxAttempts: 1;
  sizeDecimals: number;
  priceDecimals: number;
  snapshotRef: string;
  snapshotObservedAt: string;
};
export type Action = {
  operation: string;
  chainId: number;
  accountId: string;
  workerId: string;
  marketId: number;
  quantity: string;
  price: string;
};
export type PolicyContext = {
  now: number;
  filledQuantity: string;
  reservedQuantity: string;
  currentPositionQuantity: string;
  currentDirection: "long" | "short";
  active: boolean;
  stopped: boolean;
};
export type ReceiptBody = {
  schemaVersion: 1;
  id: string;
  mode: "REPLAY";
  createdAt: string;
  scenario: Scenario;
  authorization: Policy;
  authorizationDigest: string;
  execution: {
    id: string;
    status: "COMPLETED" | "REJECTED" | "PARTIAL" | "UNKNOWN";
    attemptedOperation: string;
    providerWrites: 0;
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
};
export type Receipt = ReceiptBody & {
  integrity: { algorithm: "SHA-256"; digest: string; meaning: string };
};
export type VerificationResult = {
  valid: boolean;
  checks: Check[];
  meaning: string;
};
