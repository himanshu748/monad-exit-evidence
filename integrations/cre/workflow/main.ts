import {
  HTTPClient,
  EVMClient,
  HTTPCapability,
  Runner,
  handler,
  getNetwork,
  consensusIdenticalAggregation,
  bytesToHex,
  hexToBase64,
  type Runtime,
  type HTTPSendRequester,
  type HTTPPayload,
} from "@chainlink/cre-sdk";
import { decodeEventLog, parseAbi, type Hex } from "viem";
import {
  verifyExitObservation,
  type ExitClaim,
} from "../../../src/core/verification.ts";
const decreaseAbi = parseAbi([
  "event PositionDecreased(uint256 perpId,uint256 accountId,uint8 positionType,uint256 startDepositCNS,uint256 endDepositCNS,uint256 startLotLNS,uint256 endLotLNS,int256 deltaPnlCNS,int256 fundingCNS)",
]);
type Config = { network: "mainnet" | "testnet" };
function fetchContext(
  sender: HTTPSendRequester,
  args: { network: "mainnet" | "testnet"; marketId: string },
) {
  const url =
    args.network === "mainnet"
      ? "https://app.perpl.xyz/api/v1/pub/context"
      : "https://testnet.perpl.xyz/api/v1/pub/context";
  const response = sender.sendRequest({ url, method: "GET" }).result();
  if (response.statusCode !== 200)
    throw new Error(`Perpl public context HTTP ${response.statusCode}`);
  const data = JSON.parse(new TextDecoder().decode(response.body));
  const market = data.markets.find((m: any) => String(m.id) === args.marketId);
  if (!market) throw new Error("Requested market absent");
  const instance = data.instances.find((i: any) => i.id === market.instance_id);
  if (!instance) throw new Error("Exchange instance absent");
  return {
    chainId: data.chain.chain_id as number,
    exchange: String(instance.address),
    marketId: String(market.id),
    observedAt: market.state.at.t as number,
  };
}
export function onRequest(runtime: Runtime<Config>, payload: HTTPPayload) {
  const claim = JSON.parse(
    new TextDecoder().decode(payload.input),
  ) as ExitClaim;
  const expectedChain = runtime.config.network === "mainnet" ? 143 : 10143;
  if (claim.chainId !== expectedChain)
    throw new Error("Claim network does not match workflow");
  if (!/^0x[0-9a-fA-F]{64}$/.test(claim.transactionHash))
    throw new Error("Invalid transaction hash");
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName:
      runtime.config.network === "mainnet" ? "monad-mainnet" : "monad-testnet",
  });
  if (!network) throw new Error("Unsupported Monad network");
  const api = new HTTPClient()
    .sendRequest(
      runtime,
      fetchContext,
      consensusIdenticalAggregation<{
        chainId: number;
        exchange: string;
        marketId: string;
        observedAt: number;
      }>(),
    )({ network: runtime.config.network, marketId: claim.marketId })
    .result();
  const receipt = new EVMClient(network.chainSelector.selector)
    .getTransactionReceipt(runtime, {
      hash: hexToBase64(claim.transactionHash as Hex),
    })
    .result().receipt;
  if (!receipt) throw new Error("Transaction receipt unavailable");
  const decreases: {
    id: string;
    accountId: string;
    marketId: string;
    before: string;
    after: string;
  }[] = [];
  for (const [index, log] of receipt.logs.entries()) {
    if (bytesToHex(log.address).toLowerCase() !== claim.exchange.toLowerCase())
      continue;
    try {
      const decoded = decodeEventLog({
        abi: decreaseAbi,
        data: bytesToHex(log.data),
        topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
      });
      const a = decoded.args;
      decreases.push({
        id: `${claim.transactionHash}:${index}`,
        accountId: a.accountId.toString(),
        marketId: a.perpId.toString(),
        before: a.startLotLNS.toString(),
        after: a.endLotLNS.toString(),
      });
    } catch {
      /* Other events cannot establish this narrowly supported quantity predicate. */
    }
  }
  const result = verifyExitObservation(claim, {
    chainId: expectedChain,
    exchange: api.exchange,
    transactionHash: bytesToHex(receipt.txHash),
    status: receipt.status === 1n ? "success" : "failed",
    apiChainId: api.chainId,
    apiExchange: api.exchange,
    apiMarketId: api.marketId,
    apiObservedAt: api.observedAt,
    observedAt: runtime.now().getTime(),
    decreases,
  });
  runtime.log(JSON.stringify(result));
  return JSON.stringify(result);
}
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(() => [
    handler(new HTTPCapability().trigger({}), onRequest),
  ]);
}
