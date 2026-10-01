import { readFile, writeFile } from 'node:fs/promises';
import { decodeEventLog } from 'viem';
import { normalizeExchangeEvent } from '../src/normalize.ts';
const abi = JSON.parse(await readFile(new URL('../abis/Exchange.json', import.meta.url), 'utf8'));
const proofs = [];
for (const [network, rpc] of [['mainnet', 'https://rpc.monad.xyz'], ['testnet', 'https://testnet-rpc.monad.xyz']]) {
  const snapshot = JSON.parse(await readFile(new URL(`../.runtime/${network}.json`, import.meta.url), 'utf8'));
  const item = snapshot.events.find(e => e.kind.includes('Filled')) ?? snapshot.events[0];
  if (!item) throw new Error(`No indexed ${network} event available for verification`);
  async function call(method, params) {
    const response = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({jsonrpc:'2.0', id:1, method, params}), signal: AbortSignal.timeout(20_000) });
    const body = await response.json(); if (!response.ok || body.error) throw new Error(JSON.stringify(body)); return body.result;
  }
  const receipt = await call('eth_getTransactionReceipt', [item.transactionHash]);
  const log = receipt.logs.find(l => parseInt(l.logIndex,16) === item.logIndex);
  if (!log || log.address.toLowerCase() !== item.contract || log.blockHash !== item.blockHash) throw new Error('Indexed provenance mismatch');
  const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true });
  const block = await call('eth_getBlockByNumber', [log.blockNumber, false]);
  const observed = normalizeExchangeEvent({ chainId: snapshot.chainId, srcAddress: log.address, eventName: decoded.eventName,
    transaction: {hash: log.transactionHash}, block: {number: parseInt(log.blockNumber,16), hash: log.blockHash, timestamp: parseInt(block.timestamp,16)}, logIndex: parseInt(log.logIndex,16), params: decoded.args });
  for (const [key,value] of Object.entries(observed)) if ((item[key] ?? null) !== value) throw new Error(`Indexed ${key} differs from independent receipt decode`);
  proofs.push({ network, verifiedAt: new Date().toISOString(), chainId: snapshot.chainId, rpc, source:'ENVIO', watermark: snapshot.watermark,
    transactionHash: item.transactionHash, blockNumber: item.blockNumber, logIndex:item.logIndex, kind:item.kind, checks: { contractMatches:true, blockHashMatches:true, decodedValuesMatch:true, chainProvenanceMatches:true }, indexedEvent:item });
}
await writeFile(new URL('../evidence/receipt-cross-check.json', import.meta.url), JSON.stringify(proofs,null,2)+'\n');
console.log(JSON.stringify(proofs.map(({network,watermark,transactionHash,kind,checks})=>({network,watermark,transactionHash,kind,checks})),null,2));
