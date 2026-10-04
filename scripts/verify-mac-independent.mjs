import { access, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { canonical } from '../src/core/canonical.ts';
import { CHAIN_INFO, hex, safeInteger } from '../integrations/envio/src/normalize.ts';

// Public real-data verification only. Requires the deployment to select HyperSync.
// This script neither configures credentials nor changes or stops any service.
const base = 'https://monad-exit-evidence.vercel.app';
const SOURCES = {
  mainnet: { envio: 'https://monad.hypersync.xyz', rpc: 'https://rpc.monad.xyz' },
  testnet: { envio: 'https://monad-testnet.hypersync.xyz', rpc: 'https://testnet-rpc.monad.xyz' },
};
async function read(path, timeout = 60_000) {
  const response = await fetch(base + path, { redirect: 'error', signal: AbortSignal.timeout(timeout) });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Public deployment returned HTTP ${response.status}`); }
  const envelope = await response.json();
  if (envelope.error || !envelope.data) throw new Error('Public read unavailable');
  return envelope.data;
}
function checkFresh(timestamp, maxAge, now) {
  const age = now - (typeof timestamp === 'string' ? Date.parse(timestamp) : NaN);
  if (!Number.isFinite(age) || age < -30_000 || age > maxAge) throw new Error('Provider evidence has invalid or stale timestamps');
}
export function checkActivity(activity, network, now = Date.now()) {
  const info = CHAIN_INFO[network], source = SOURCES[network];
  if (!info || activity.status !== 'live' || activity.source !== 'ENVIO' || activity.chainId !== info.chainId || activity.engine !== 'HYPERSYNC' || activity.sourceUrl !== source.envio || !Array.isArray(activity.events)) throw new Error(`Real complete HyperSync activity unavailable on ${network}`);
  safeInteger(activity.windowStartBlock); safeInteger(activity.providerHead);
  if (activity.windowStartBlock > activity.providerHead || activity.watermark !== activity.providerHead) throw new Error(`Invalid HyperSync coverage on ${network}`);
  checkFresh(activity.receivedAt, 120_000, now);
  checkFresh(activity.providerHeadObservedAt, 300_000, now);
}
function checkEvent(event, network, activity) {
  const info = CHAIN_INFO[network];
  const hash = hex(event.transactionHash, 64), index = safeInteger(event.logIndex), block = safeInteger(event.blockNumber);
  hex(event.blockHash, 64);
  if (event.chainId !== info.chainId || event.contract !== info.contract || event.source !== 'ENVIO' || event.id !== `${info.chainId}:${hash}:${index}` || block < activity.windowStartBlock || block > activity.providerHead) throw new Error('Invalid selected HyperSync event provenance');
}
// Injectable clock/read/wait are used only by offline regression tests. The CLI
// always uses actual public reads and actual elapsed time.
export async function discoverActivity(network, { readActivity = read, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const deadline = now() + 180_000;
  while (now() < deadline) {
    const activity = await readActivity(`/api/activity?network=${network}`, Math.min(60_000, deadline - now()));
    checkActivity(activity, network, now());
    if (now() >= deadline) break;
    if (activity.events.length) { checkEvent(activity.events[0], network, activity); return activity; }
    await wait(Math.min(11_000, deadline - now()));
  }
  throw new Error(`Inconclusive: no real HyperSync event appeared on ${network} within three minutes; finite previews do not establish event absence`);
}
export async function validateEvidenceDirectory(directory) {
  if (typeof directory !== 'string' || !directory.trim()) throw new Error('EVIDENCE_DIR must name an existing writable directory');
  const path = resolve(directory);
  if (!(await stat(path)).isDirectory()) throw new Error('EVIDENCE_DIR must name an existing writable directory');
  await access(path, constants.W_OK | constants.X_OK);
  return path;
}
export async function writePublicProof(result, directory) {
  const stamp = new Date(result.checkedAt).toISOString().replace(/[:.]/g, '-');
  const path = resolve(directory, `mac-independent-public-proof-${stamp}-${randomUUID()}.json`);
  await writeFile(path, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return path;
}
export async function waitForHistoricalWindow(network, event, { readActivity = read, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const deadline = now() + 180_000;
  while (now() < deadline) {
    await wait(Math.min(11_000, deadline - now()));
    if (now() >= deadline) break;
    const advanced = await readActivity(`/api/activity?network=${network}`, Math.min(60_000, deadline - now()));
    checkActivity(advanced, network, now());
    // Elapsed time alone cannot prove that the preview has advanced. Require
    // the selected block to lie strictly outside the provider-reported window.
    if (now() < deadline && advanced.windowStartBlock > event.blockNumber) return advanced;
  }
  throw new Error(`HyperSync preview did not advance past selected ${network} event within three minutes`);
}
export function checkObservation(observation, network, event, advanced, now = Date.now()) {
  const info = CHAIN_INFO[network], source = SOURCES[network];
  const indexed = observation.envio, observed = observation.observation;
  if (!info || observation.schema !== 'exit-evidence-observation/v1' || observation.network !== network || observation.chainId !== info.chainId || observation.sourceUrl !== source.rpc || observation.outcome !== 'INDEX_AND_CHAIN_MATCH' || indexed?.status !== 'MATCH' || indexed.engine !== 'HYPERSYNC' || indexed.sourceUrl !== source.envio || observed?.source !== 'MONAD_PUBLIC_RPC') throw new Error(`Independent source comparison failed on ${network}`);
  safeInteger(indexed.providerHead);
  if (advanced.windowStartBlock <= event.blockNumber || indexed.windowStartBlock !== event.blockNumber || indexed.watermark !== event.blockNumber || indexed.providerHead < advanced.providerHead || observed.chainId !== info.chainId || observed.contract !== info.contract || observed.id !== event.id || observed.blockNumber !== event.blockNumber || observed.transactionHash !== event.transactionHash || observed.logIndex !== event.logIndex) throw new Error(`Historical HyperSync lookup was not proven on ${network}`);
  if (canonical(observed) !== canonical({ ...event, source: 'MONAD_PUBLIC_RPC', decoded: JSON.parse(event.decoded) })) throw new Error(`Selected event changed during verification on ${network}`);
  checkFresh(observation.verifiedAt, 120_000, now);
  checkFresh(indexed.checkedAt, 120_000, now);
  checkFresh(indexed.providerHeadObservedAt, 300_000, now);
  const { integrity, ...body } = observation;
  const digest = createHash('sha256').update(canonical(body)).digest('hex');
  if (integrity?.algorithm !== 'SHA-256' || integrity.digest !== digest) throw new Error('Observation digest mismatch');
}
export async function main() {
  // Fail before any provider read; this verifier never creates arbitrary paths.
  const evidenceDirectory = process.env.EVIDENCE_DIR === undefined ? undefined : await validateEvidenceDirectory(process.env.EVIDENCE_DIR);
  const result = { checkedAt: new Date().toISOString(), base, observations: [] };
  for (const network of ['mainnet', 'testnet']) {
    const activity = await discoverActivity(network);
    const event = activity.events[0];
    checkEvent(event, network, activity);
    const advanced = await waitForHistoricalWindow(network, event);
    const observation = await read(`/api/observations?${new URLSearchParams({ network, transactionHash: event.transactionHash, logIndex: String(event.logIndex) })}`);
    checkObservation(observation, network, event, advanced);
    result.observations.push({ network, activity, advancedActivity: advanced, observation });
    console.log(JSON.stringify({ network, activityEngine: activity.engine, watermark: activity.watermark, providerHead: activity.providerHead, transactionHash: event.transactionHash, outcome: observation.outcome }));
  }
  if (evidenceDirectory) {
    console.log(`Saved public proof: ${await writePublicProof(result, evidenceDirectory)}`);
  }
  console.log('Both networks independently verified against genuine Envio HyperSync. Local service shutdown must be recorded separately.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
