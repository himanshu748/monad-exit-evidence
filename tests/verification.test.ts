import test from "node:test";
import assert from "node:assert/strict";
import { digest } from "../src/core/receipt.ts";
import { verifyExitObservation } from "../src/core/verification.ts";
const address = "0x1111111111111111111111111111111111111111";
const hash = "0x" + "ab".repeat(32);
const policy = {
  schemaVersion: 1,
  chainId: 143,
  exchange: address,
  accountId: "12",
  marketId: "1",
  authorizedCloseQuantity: "2000",
};
const request = {
  chainId: 143,
  exchange: address,
  transactionHash: hash,
  accountId: "12",
  marketId: "1",
  authorizedCloseQuantity: "2000",
  policyDigest: digest(policy),
  policy,
};
const observation = {
  chainId: 143,
  exchange: address,
  transactionHash: hash,
  status: "success",
  apiChainId: 143,
  apiExchange: address,
  apiMarketId: "1",
  apiObservedAt: 1790844800000,
  observedAt: 1790844800000,
  decreases: [
    {
      id: "log-1",
      accountId: "12",
      marketId: "1",
      before: "4000",
      after: "2000",
    },
  ],
};
test("chain and external API evidence establish only the named reduction observation", () => {
  const r = verifyExitObservation(request, observation);
  assert.equal(r.outcome, "VERIFIED_OBSERVATION");
  assert.equal(r.filledQuantity, "2000");
  assert.equal(r.ownerAuthorizationVerified, false);
});
test("wrong chain/exchange/tx and quantity beyond policy contradict result", () => {
  for (const patch of [
    { chainId: 10143 },
    { exchange: "0x" + "22".repeat(20) },
    { transactionHash: "0x" + "ee".repeat(32) },
    { decreases: [{ ...observation.decreases[0], after: "0" }] },
  ])
    assert.equal(
      verifyExitObservation(request, { ...observation, ...patch }).outcome,
      "CONTRADICTED",
    );
});
test("missing decrease is inconclusive; failed transaction is contradicted", () => {
  assert.equal(
    verifyExitObservation(request, { ...observation, decreases: [] }).outcome,
    "INCONCLUSIVE",
  );
  assert.equal(
    verifyExitObservation(request, { ...observation, status: "failed" })
      .outcome,
    "CONTRADICTED",
  );
});
test("stale API evidence cannot produce verified result", () =>
  assert.equal(
    verifyExitObservation(request, {
      ...observation,
      apiObservedAt: 1790844600000,
    }).outcome,
    "INCONCLUSIVE",
  ));
test("duplicate event is counted once and conflicting duplicate is rejected", () => {
  assert.equal(
    verifyExitObservation(request, {
      ...observation,
      decreases: [...observation.decreases, ...observation.decreases],
    }).filledQuantity,
    "2000",
  );
  assert.equal(
    verifyExitObservation(request, {
      ...observation,
      decreases: [
        ...observation.decreases,
        { ...observation.decreases[0], after: "1999" },
      ],
    }).outcome,
    "CONTRADICTED",
  );
});

test("policy preimage and exact limits bind the observation", () => {
  assert.equal(
    verifyExitObservation(
      { ...request, policyDigest: "0".repeat(64) },
      observation,
    ).outcome,
    "CONTRADICTED",
  );
  assert.equal(
    verifyExitObservation(
      { ...request, policy: { ...policy, authorizedCloseQuantity: "3000" } },
      observation,
    ).outcome,
    "CONTRADICTED",
  );
  assert.equal(
    verifyExitObservation({ ...request, policy: undefined } as any, observation)
      .outcome,
    "CONTRADICTED",
  );
});
