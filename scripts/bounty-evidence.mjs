import { getMarkets, getOrderBook } from '../src/data/perpl.ts';
import { getEnvioActivity } from '../src/data/envio.ts';
import { getNansenStatus } from '../src/data/nansen.ts';

// Public reads and local Envio snapshots only. No rehearsals, wallet operations,
// provider writes, credentials, indexer reset or saved-evidence fallback.
async function inspectNetwork(network) {
  const activity = await getEnvioActivity(network);
  let perpl;
  try {
    const context = await getMarkets(network);
    const market = context.markets.find(m => m.symbol === 'BTC') ?? context.markets[0];
    if (!market) throw new Error('No supported market returned');
    const book = await getOrderBook(network, market.id);
    perpl = {
      status: context.stale || book.stale ? 'unavailable' : 'live',
      chainId: context.chainId,
      markets: {
        source: context.source, sourceUrl: context.sourceUrl,
        receivedAt: context.receivedAt, observedAt: context.observedAt,
        snapshotRef: context.snapshotRef, stale: context.stale,
        count: context.markets.length,
      },
      liquidity: {
        source: book.source, sourceUrl: book.sourceUrl,
        receivedAt: book.receivedAt, observedAt: book.observedAt, stale: book.stale,
        marketId: market.id, symbol: market.symbol,
        sizeDecimals: book.sizeDecimals, priceDecimals: book.priceDecimals,
        returnedBidLevels: book.bids.length, returnedAskLevels: book.asks.length,
        bidPreview: book.bids.slice(0, 5), askPreview: book.asks.slice(0, 5),
      },
    };
  } catch (error) {
    perpl = { status: 'unavailable', error: error instanceof Error ? error.message : 'Public provider read failed' };
  }
  return { network, perpl, envio: activity };
}

const startedAt = new Date().toISOString();
const networks = await Promise.all(['mainnet', 'testnet'].map(inspectNetwork));
const demoDataReadyNetworks = networks
  .filter(n => n.perpl.status === 'live' && n.envio.status === 'live')
  .map(n => n.network);
const report = {
  schema: 'exit-evidence-bounty-check/v1',
  startedAt, completedAt: new Date().toISOString(),
  mode: 'READ_ONLY',
  networks, demoDataReadyNetworks,
  demoDataReady: demoDataReadyNetworks.length > 0,
  bountyEligibility: 'Envio demonstrated; primary entry eligibility and sustained hosting unresolved', submissionReady: false,
  candidates: ['Best Use of Envio'],
  excludedBounties: { perplApi: 'Requires bot execution absent here', perplAnalytics: 'Required protocol/wallet portfolio views absent here' },
  cre: { bounty: 'omitted-user-choice', successfulCliSimulationClaimed: false },
  nansen: getNansenStatus(),
  remainingGates: [
    'Confirm primary-track eligibility and accurate participant entry fields.',
    'Establish sustained accessible hosting and review deployment security.',
    'Verify public source and qualifying YouTube/Loom/Vimeo technical and pitch URLs.',
    'Supply accurate participant fields and personally accept required agreements.',
  ],
  limitations: [
    'Readiness refers only to contemporaneous public Perpl and Envio data on the same network.',
    'Book depth is a snapshot estimate, not an executable price, guaranteed fill or risk recommendation.',
    'Envio events concern public participants, not this app, its rehearsals or the viewer.',
    'No wallet holdings, signatures, real trading or successful CRE simulation are established.',
  ],
};
console.log(JSON.stringify(report, null, 2));
if (!report.demoDataReady) process.exitCode = 1;
