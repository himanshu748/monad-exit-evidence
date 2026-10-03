import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { decodeEventLog } from 'viem';
import { parseEnvioSnapshot } from '../../../src/data/envio.ts';
import { exitPolicyDigest, verifyExitObservation } from '../../../src/core/verification.ts';

// This generates a hypothetical policy over an arbitrary participant's public
// testnet observation. It is never user authority, a signature, or an app trade.
const snapshot = JSON.parse(await readFile(new URL('../../envio/.runtime/testnet.json', import.meta.url), 'utf8'));
parseEnvioSnapshot(snapshot, 'testnet');
const event = snapshot.events.find(e => e.kind === 'PositionDecreased' && BigInt(e.quantity ?? '0') > 0n);
if (!event) throw new Error('No supported position-decrease event in the fresh testnet window. Keep Envio running and retry; no fixture will be substituted.');
const rpc = 'https://testnet-rpc.monad.xyz';
const response = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [event.transactionHash] }), signal: AbortSignal.timeout(20_000) });
const body = await response.json();
const receipt = body.result;
if (!response.ok || body.error || !receipt || receipt.transactionHash.toLowerCase() !== event.transactionHash || receipt.status !== '0x1') throw new Error('Public testnet receipt unavailable or unsuccessful');
const indexedLog = receipt.logs.find(l => Number(BigInt(l.logIndex)) === event.logIndex);
if (!indexedLog || indexedLog.address.toLowerCase() !== snapshot.contract || indexedLog.blockHash.toLowerCase() !== event.blockHash || Number(BigInt(indexedLog.blockNumber)) !== event.blockNumber) throw new Error('Indexed receipt provenance mismatch');
const abi = JSON.parse(await readFile(new URL('../../envio/abis/Exchange.json', import.meta.url), 'utf8'));
const decreases = [];
for (const log of receipt.logs) {
  if (log.address.toLowerCase() !== snapshot.contract) continue;
  let decoded;
  try { decoded = decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true }); } catch { continue; }
  if (decoded.eventName !== 'PositionDecreased') continue;
  const a = decoded.args;
  decreases.push({ id: `${event.transactionHash}:${Number(BigInt(log.logIndex))}`, accountId: a.accountId.toString(), marketId: a.perpId.toString(), before: a.startLotLNS.toString(), after: a.endLotLNS.toString() });
}
const selected = decreases.find(d => d.id === `${event.transactionHash}:${event.logIndex}`);
if (!selected || selected.accountId !== event.accountId || selected.marketId !== event.marketId || (BigInt(selected.before) - BigInt(selected.after)).toString() !== event.quantity) throw new Error('Indexed decoded values differ from public receipt');
const matching = decreases.filter(d => d.accountId === event.accountId && d.marketId === event.marketId);
if (matching.some(d => BigInt(d.after) >= BigInt(d.before))) throw new Error('Unsupported decrease quantities');
const quantity = matching.reduce((n, d) => n + BigInt(d.before) - BigInt(d.after), 0n).toString();
const policy = { schemaVersion: 1, chainId: 10143, exchange: snapshot.contract, accountId: event.accountId, marketId: event.marketId, authorizedCloseQuantity: quantity };
const claim = { ...policy, transactionHash: event.transactionHash, policyDigest: exitPolicyDigest(policy), policy };
delete claim.schemaVersion;
const apiResponse = await fetch('https://testnet.perpl.xyz/api/v1/pub/context', { signal: AbortSignal.timeout(15_000) });
if (!apiResponse.ok) throw new Error('Public Perpl context unavailable');
const context = await apiResponse.json();
const market = context.markets.find(m => String(m.id) === claim.marketId);
const instance = market && context.instances.find(i => i.id === market.instance_id);
if (!market || !instance) throw new Error('Observed market is absent from current public context');
const result = verifyExitObservation(claim, { chainId: 10143, exchange: snapshot.contract, transactionHash: receipt.transactionHash,
  status: 'success', apiChainId: context.chain.chain_id, apiExchange: instance.address, apiMarketId: String(market.id),
  apiObservedAt: market.state.at.t, observedAt: Date.now(), decreases });
const output = new URL('../.runtime/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('claim.json', output), JSON.stringify(claim, null, 2) + '\n');
await writeFile(new URL('claim-provenance.json', output), JSON.stringify({ generatedAt: new Date().toISOString(), source: 'ENVIO plus independent public RPC receipt and Perpl context', snapshotQueriedAt: snapshot.queriedAt, watermark: snapshot.watermark,
  indexedEvent: event, rpc, localPredicateResult: result, creSimulationPerformed: false, ownerAuthorizationVerified: false, policyMode: 'HYPOTHETICAL_PUBLIC_OBSERVATION' }, null, 2) + '\n');
console.log(JSON.stringify({ claimPath: output.pathname + 'claim.json', transactionHash: claim.transactionHash, localPredicateOutcome: result.outcome, creSimulationPerformed: false, ownerAuthorizationVerified: false }, null, 2));
